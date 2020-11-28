const { mongoConnect } = require("../../mongo")

module.exports = ({ findQuery, userAgent }) => {
  const fnUpdateUserAgent = async db => {
    const userCollection = db.collection("User")
    await userCollection.updateOne(findQuery, { $set: { userAgent } })
  }
  mongoConnect(fnUpdateUserAgent)
}
