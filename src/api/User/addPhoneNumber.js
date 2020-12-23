const { redirectDomain, websiteSettings } = require("../../../config")
const { getToken } = require("../../auth")
const { validatePhoneFormat } = require("../../util")
const { mongoConnect, ObjectID } = require("../../mongo")
const { sendText } = require("../../util/twilio")
const createMagicLinkAndHash = require("./createMagicLinkAndHash")
const failedError = require("../failedError")

module.exports = async (req, res) => {
  try {
    // destructure parameters
    let {
      params: { phone },
      query: { resend },
    } = req

    // required parameters
    if (!phone) return res.sendStatus(400)

    // validate phone number
    const validPhone = validatePhoneFormat(phone)
    if (!validPhone) return res.send(failedError(400, "Invalid phone format."))

    // new data to update
    const [magicLinkToken, magicLinkTokenHash] = createMagicLinkAndHash()
    const magicLinkExpires = new Date()
    magicLinkExpires.setMinutes(magicLinkExpires.getMinutes() + 10)

    /** Insert the user */
    const userQuery = { _id: ObjectID(req.jwtData.user._id) }

    // db function
    const fnAddPhone = async (db, promise) => {
      const userCollection = db.collection("User")

      let existingUser = await userCollection
        .findOne(userQuery)
        .catch(() => undefined)

      if (existingUser) {
        if (existingUser.phone && existingUser.phone.length) {
          if (resend) {
            req.params.user = { ...existingUser }
            phone = existingUser.phone

            let authTokens = existingUser.authTokens || []
            authTokens = authTokens.filter(t => t.exp > new Date())
            existingUser = await userCollection.updateOne(userQuery, {
              $set: {
                authTokens: [
                  ...authTokens,
                  {
                    hex: magicLinkTokenHash,
                    exp: magicLinkExpires,
                    verify: "phone",
                  },
                ],
              },
            })

            promise.resolve(existingUser)
          } else {
            promise.resolve(
              failedError(405, "You have already saved a phone number")
            )
          }
        } else {
          req.params.user = { ...existingUser, phone }

          let authTokens = existingUser.authTokens || []
          authTokens = authTokens.filter(t => t.exp > new Date())
          existingUser = await userCollection.updateOne(userQuery, {
            $set: {
              authTokens: [
                ...authTokens,
                {
                  hex: magicLinkTokenHash,
                  exp: magicLinkExpires,
                  verify: "phone",
                },
              ],
              phone,
            },
          })
        }

        promise.resolve(existingUser)
      } else promise.resolve({ error: "Error updating user." })
    }

    // db call
    const addedPhoneNumber = await mongoConnect(fnAddPhone).catch(c => {
      console.error(c, req)
    })

    // send response
    if (!addedPhoneNumber) return res.sendStatus(500)
    else if (addedPhoneNumber.error) return res.send(addedPhoneNumber)
    else if (req.params.user && req.params.user.phone) {
      /** @DEV Send a text for the user to verify their phone number */
      const link = `${redirectDomain}/token/${magicLinkToken}`
      sendText({
        body: `Click this link to verify your phone on ${websiteSettings.friendlyName}\n\n${link}\n\nOr copy this token to the login form:\n\n${magicLinkToken}\n\n`,
        phone: req.params.user.phone,
      })

      /** @TODO send back fresh JWT set with phone in payload */
      return getToken(
        {
          ...req,
          params: {
            email: req.params.user.email,
            phone: req.params.user.phone,
            username: req.params.user.username,
            _id: req.params.user._id,
          },
        },
        res
      )
    } else res.send(failedError(400, "Error"))
  } catch (err) {
    console.error(err, req)
    return res.status(500).send(err)
  }
}
