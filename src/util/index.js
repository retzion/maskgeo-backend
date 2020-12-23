const sendMail = require("./nodemailer")
const { sendText } = require("./twilio")

function validatePhoneFormat(phone) {
  return /^\+[1-9]\d{10,14}$/.test(phone)
}

module.exports = {
  sendMail,
  sendText,
  validatePhoneFormat,
}
