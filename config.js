const websiteSettings = {
  friendlyName: "Mask Forecast",
  oneWordName: "MaskForecast",
  phone: "+14697783293",
}

const appEnvironments = {
  local: "local",
  production: "production",
}

const appEnvironment = appEnvironments[process.env["MG_ENV"] || "production"]

const apiDomains = {
  development: "https://staging-maskgeo-backend.herokuapp.com",
  local: "http://localhost:3001",
  production: "https://api.maskforecast.com",
}
const apiDomain = apiDomains[appEnvironment]

const redirectDomains = {
  development: "https://staging-maskgeo-frontend.herokuapp.com",
  local: "http://localhost:3000",
  production: "https://www.maskforecast.com",
}
const redirectDomain = redirectDomains[appEnvironment]

const smtpAccount = {
  auth: {
    user: process.env["NODEMAILER_EMAIL"],
    pass: process.env["NODEMAILER_PASSWORD"],
  },
  host: "aztek.websitewelcome.com",
  port: 465,
  senderName: websiteSettings.oneWordName,
}

const google = {
  apiKey: process.env["GOOGLE_PLACES_API_KEY"],
  outputFormat: process.env["GOOGLE_PLACES_OUTPUT_FORMAT"] || "json",
}

module.exports = {
  apiDomain,
  appEnvironment,
  appEnvironments,
  google,
  redirectDomain,
  smtpAccount,
  websiteSettings,
}
