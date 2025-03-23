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
const { saveCurrentSupplies } = require('./controllers/supplyHistory');


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

// Her 2 saatte bir kontrol et
cron.schedule('0 */2 * * *', async () => {
  console.log('Running regular supply history check...');
  try {
    const result = await saveCurrentSupplies();
    console.log('Supply history check result:', result);
  } catch (error) {
    console.error('Supply history check failed:', error);
  }
});

// Gece yarısı ekstra kontrol
cron.schedule('0 0 * * *', async () => {
  console.log('Running midnight supply history check...');
  try {
    const result = await saveCurrentSupplies();
    console.log('Midnight supply history check result:', result);
  } catch (error) {
    console.error('Midnight supply history check failed:', error);
  }
});

// Her saat başı kontrol et (0. dakikada)
cron.schedule('0 * * * *', async () => {
  console.log('Running hourly supply history check...');
  try {
    const result = await saveCurrentSupplies();
    console.log('Supply history check result:', result);
  } catch (error) {
    console.error('Supply history check failed:', error);
  }
});

start();
