const { websiteSettings } = require("../../../config")
const { ObjectID, mongoConnect } = require("../../mongo")
const { sendMail } = require("../../util")
const createMagicLinkAndHash = require("./createMagicLinkAndHash")

module.exports = async (req, res) => {
  const { email } = req.params
  let userData

  // required parameters
  if (!email) return res.sendStatus(400)

  // new data to update
  const [magicLinkToken, magicLinkTokenHash] = createMagicLinkAndHash()
  const magicLinkExpires = new Date()
  magicLinkExpires.setMinutes(magicLinkExpires.getMinutes() + 10)

  // db function
  const fnUpdateMagicLinkData = async (db, promise) => {
    const userCollection = db.collection("User")
    userData = await userCollection
      .findOne({ email: email.toLowerCase() })
      .catch(() => undefined)
    if (userData) {
      const updated = await userCollection
        .updateOne(
          { _id: new ObjectID(userData._id) },
          { $set: { magicLinkTokenHash, magicLinkExpires } }
        )
        .catch(e => {
          console.error(e, req)
          promise.resolve()
        })
      if (updated) promise.resolve(updated)
      else promise.resolve()
    } else promise.resolve()
  }

  // db call
  const updatedUser = await mongoConnect(fnUpdateMagicLinkData)

  if (
    updatedUser &&
    updatedUser.result.nModified === 1 &&
    updatedUser.result.ok === 1
  ) {
    // send response
    /** @DEV Create and email a magic link containing a token to fetch a JWT */
    sendMail(email, "MaskForecast Login Link", "magic-link", {
      email,
      username: userData.username,
      expires: "in 10 minutes",
      link: `${req.headers.origin}/token/${magicLinkToken}`,
      buttonBackgroundColor: "cornflowerblue",
      buttonTextColor: "#ffffff",
      websiteOneWordName: websiteSettings.oneWordName,
    })
    res.send()
  } else res.sendStatus(400)
}
