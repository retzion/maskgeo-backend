const nodemailer = require("nodemailer")
const fs = require("fs")

const { smtpAccount, websiteSettings } = require("../../../config")

const mailServerOptions = {
  ...smtpAccount,
  secure: true,
}
const transporter = nodemailer.createTransport(mailServerOptions)

module.exports = async (email, subject, templateName, variables) => {
  if (!email || !subject || !templateName) throw "missing parameters"

  variables = {
    ...variables,
    buttonBackgroundColor: "cornflowerblue",
    buttonTextColor: "#ffffff",
    websiteFriendlyName: websiteSettings.friendlyName,
    websiteOneWordName: websiteSettings.oneWordName,
}

  const htmlFilePath = `./src/util/nodemailer/templates/${templateName}.html`
  const textFilePath = `./src/util/nodemailer/templates/${templateName}.txt`

  let htmlTemplate = fs.readFileSync(htmlFilePath, {
    encoding: "utf8",
    flag: "r",
  })
  let textTemplate = fs.readFileSync(textFilePath, {
    encoding: "utf8",
    flag: "r",
  })

  for (let [key, value] of Object.entries(variables)) {
    const re = new RegExp(`{{${key}}}`, "g")
    htmlTemplate = htmlTemplate.replace(re, value)
    textTemplate = textTemplate.replace(re, value)
  }

  const mailOptions = {
    from: {
      address: smtpAccount["auth"]["user"],
      name: smtpAccount["senderName"],
    },
    to: email,
    subject,
    html: htmlTemplate,
    text: textTemplate,
  }

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) console.error(error)
    else console.log("Email sent: " + info.response)
  })
}
