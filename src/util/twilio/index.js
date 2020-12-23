const { websiteSettings } = require("../../../config")

// Twilio Credentials
// To set up environmental variables, see http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN

// require the Twilio module and create a REST client
const client = require("twilio")(accountSid, authToken)

const sendText = ({ body, phone }) =>
  new Promise((resolve, reject) => {
    client.messages
      .create({
        to: phone,
        from: websiteSettings.phone,
        body,
      })
      .then(message => {
        console.log("Twilio message sent " + message.sid)
        resolve(message.sid)
      })
      .catch(c => {
        console.error(c)
        reject(c)
      })
  })

module.exports = {
  sendText,
}
