const websiteSettings = {
  friendlyName: "Mask Forecast",
  oneWordName: "MaskForecast",
}

const appEnvironments = {
  local: "local",
  production: "production",
}

const appEnvironment = appEnvironments[process.env["MG_ENV"] || "production"]

const smtpAccount = {
  auth: {
    user: process.env["NODEMAILER_EMAIL"],
    pass: process.env["NODEMAILER_PASSWORD"],
  },
  host: "aztek.websitewelcome.com",
  port: 465,
  senderName: websiteSettings.oneWordName,
}

module.exports = {
  appEnvironment,
  appEnvironments,
  smtpAccount,
  websiteSettings,
}
