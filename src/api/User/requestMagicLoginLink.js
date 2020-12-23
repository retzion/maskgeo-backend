const { redirectDomain, websiteSettings } = require("../../../config")
const { ObjectID, mongoConnect } = require("../../mongo")
const { sendMail, sendText } = require("../../util")
const createMagicLinkAndHash = require("./createMagicLinkAndHash")

module.exports = async (req, res) => {
  const { email = "", phone = "" } = req.params
  let userData

  // required parameters
  if (!email.length && !phone.length) return res.sendStatus(400)

  // new data to update
  const [magicLinkToken, magicLinkTokenHash] = createMagicLinkAndHash()
  const magicLinkExpires = new Date()
  magicLinkExpires.setMinutes(magicLinkExpires.getMinutes() + 10)

  // db function
  const fnUpdateMagicLinkData = async (db, promise) => {
    const userCollection = db.collection("User")
    userData = await userCollection
      .findOne({ $or: [{ email: email.toLowerCase() }, { phone }] })
      .catch(() => undefined)
    if (userData) {
      let authTokens = userData.authTokens || []
      authTokens = authTokens.filter(t => t.exp > new Date())
      let newToken = {
        hex: magicLinkTokenHash,
        exp: magicLinkExpires,
      }
      if (email) newToken.verify = "email"
      if (phone) newToken.verify = "phone"
      const updated = await userCollection
        .updateOne(
          { _id: new ObjectID(userData._id) },
          {
            $set: {
              authTokens: [...authTokens, newToken],
            },
          }
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
    const link = `${redirectDomain}/token/${magicLinkToken}`

    /** @DEV Create and send a magic link containing a token to fetch a JWT */
    if (email)
      sendMail(
        email,
        `${websiteSettings.friendlyName} Login Link`,
        "magic-link",
        {
          profileLink: `${req.headers.origin}/?profile`,
          email,
          username: userData.username,
          expires: "in 10 minutes",
          link,
          magicLinkToken,
        }
      )
    else if (phone)
      sendText({
        body: `Click this link to log into ${websiteSettings.friendlyName}\n\n${link}\n\nOr copy this token to the login form:\n\n${magicLinkToken}\n\n`,
        phone,
      })
    res.send({status: 200, message: "OK"})
  } else res.sendStatus(400)
}
