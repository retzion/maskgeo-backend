const GooglePlaces = require("googleplaces")
const { google: googleConfig } = require("../config")

const googlePlaces = new GooglePlaces(
  googleConfig.apiKey,
  googleConfig.outputFormat
)

const placeDetails = reference => {
  return new Promise((resolve, reject) => {
    googlePlaces.placeDetailsRequest({ reference }, (err, res) => {
      if (err) reject(err)
      resolve(res)
    })
  })
}

module.exports = {
  placeDetails,
}
