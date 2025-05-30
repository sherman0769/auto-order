const { onRequest } = require("firebase-functions/v2/https");

// v2 語法：在 options 裡指定 region
exports.helloWorld = onRequest({ region: "asia-east1" }, (req, res) => {
  res.send("Hello from auto-order!");
});
