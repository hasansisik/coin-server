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

// Günde 3 kez çalışacak şekilde ayarla (00:00, 12:00, 02:40)
cron.schedule('0 0,12 * * *', async () => {
  console.log('Running scheduled supply history check...');
  try {
    await saveCurrentSupplies();
    console.log('Scheduled supply history check completed');
  } catch (error) {
    console.error('Scheduled supply history check failed:', error);
  }
});

cron.schedule('40 2 * * *', async () => {
  console.log('Running night supply history check...');
  try {
    await saveCurrentSupplies();
    console.log('Night supply history check completed');
  } catch (error) {
    console.error('Night supply history check failed:', error);
  }
});

start();
