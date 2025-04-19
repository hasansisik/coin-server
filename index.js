require("dotenv").config();
require("express-async-errors");
//express
const cors = require("cors");
const express = require("express");
const app = express();
const cron = require('node-cron');
app.use(cors());

// rest of the packages
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

//database
const connectDB = require("./config/connectDB");

//routers
const authRouter = require("./routers/auth");
const footerRouter = require("./routers/footerRoutes");
const supplyHistoryRouter = require("./routers/supplyHistory");
const coingeckoRouter = require("./routers/coingecko");
const { saveCurrentSupplies, saveDailyData } = require('./controllers/supplyHistory');


//midlleware
const notFoundMiddleware = require("./middleware/not-found");
const erorHandlerMiddleware = require("./middleware/eror-handler");

//app
app.use(morgan("tiny"));
app.use(express.json());
app.use(cookieParser(process.env.JWT_SECRET_KEY));

app.use(express.urlencoded({ extended: true }));

app.use("/v1/auth", authRouter);
app.use("/v1/footer", footerRouter);
app.use("/v1/supply-history", supplyHistoryRouter);
app.use("/v1/coingecko", coingeckoRouter);

app.use(notFoundMiddleware);
app.use(erorHandlerMiddleware);

const port = process.env.PORT || 3040;

const start = async () => {
  try {
    await connectDB(process.env.MONGO_URL);
    app.listen(
      port,
      console.log(
        `MongoDb Connection Successful,App started on port ${port} : ${process.env.NODE_ENV}`
      )
    );
  } catch (error) {
    console.log(error);
  }
};

// Günde bir kez (gece yarısı) veri toplaması çalıştır
cron.schedule('0 0 * * *', async () => {
  console.log('Running daily coin data collection...');
  try {
    const result = await saveDailyData();
    console.log('Daily coin data collection result:', result);
  } catch (error) {
    console.error('Daily coin data collection failed:', error);
  }
});

start();
