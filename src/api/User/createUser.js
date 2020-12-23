const { redirectDomain, websiteSettings } = require("../../../config")
const { sendMail, validatePhoneFormat } = require("../../util")
const { mongoConnect } = require("../../mongo")
const createMagicLinkAndHash = require("./createMagicLinkAndHash")
const failedError = require("../failedError")
const { sendText } = require("../../util/twilio")

module.exports = async (req, res) => {
  try {
    // destructure parameters
    let {
      body: { email, username, phone },
    } = req
    email = email.toLowerCase()

    // required parameters
    if (!email || !username) return res.sendStatus(400)

    // validate email format
    const validEmailExp = new RegExp(/^([a-zA-Z0-9 \@\._-]+)$/)
    const validEmail = validEmailExp.test(email)
    if (!validEmail)
      return res.status(422).send("Invalid characters found in email.")

    // validate username format
    const validUserExp = new RegExp(/^([a-zA-Z0-9_]+)$/)
    const validUsername = validUserExp.test(username)
    if (username.length < 3)
      return res
        .status(422)
        .send(failedError(422, "Usernames must be 3 characters or more."))
    if (!validUsername)
      return res
        .status(422)
        .send(failedError(422, "Invalid characters found in username."))

    // validate phone number
    const validPhone = validatePhoneFormat(phone)

    /** Insert the user */
    let orQueryArray = [
      { username: { $regex: new RegExp(username, "i") } },
      { email },
    ]
    if (validPhone) orQueryArray.push({ phone })
    const [emailToken, emailTokenHash] = createMagicLinkAndHash()
    const [phoneToken, phoneTokenHash] = createMagicLinkAndHash()
    let newUser

    // db function
    const fnCreateUser = async (db, promise) => {
      const userCollection = db.collection("User")
      let existingUser = await userCollection
        .findOne({ $or: orQueryArray })
        .catch(() => undefined)
      if (existingUser) {
        if (existingUser.email === email)
          promise.resolve({ error: "Email address already exists." })
        if (existingUser.username.toLowerCase() === username.toLowerCase())
          promise.resolve({ error: "Username already exists." })
        if (existingUser.phone === phone)
          promise.resolve({ error: "Phone number already exists." })
      } else {
        const magicLinkExpires = new Date()
        magicLinkExpires.setMinutes(magicLinkExpires.getMinutes() + 10)
        newUser = {
          authTokens: [{ hex: emailTokenHash, exp: magicLinkExpires, verify: "email" }],
          email,
          userAgent: req.headers["user-agent"],
          username,
        }
        if (validPhone) {
          newUser.authTokens.push({
            hex: phoneTokenHash,
            exp: magicLinkExpires,
            verify: "phone",
          })
          newUser.phone = phone
        }
        existingUser = await userCollection.insertOne(newUser).catch(e => {
          console.error(e, req)
          promise.resolve({ error: "Error creating user." })
        })
      }
      if (existingUser) promise.resolve(existingUser)
      else promise.resolve({ error: "Error creating user." })
    }

    // db call
    const createdUser = await mongoConnect(fnCreateUser).catch(c => {
      console.error(c, req)
    })

    // send response
    if (!createdUser) return res.sendStatus(500)
    else if (createdUser.error) return res.send(createdUser)
    else {
      const emailLink = `${redirectDomain}/token/${emailToken}`
      const phoneLink = `${redirectDomain}/token/${phoneToken}`

      /** @DEV Create and email a magic link containing a token to fetch a JWT */
      await sendMail(email, `Welcome to ${websiteSettings.oneWordName}`, "new-account", {
        profileLink: `${req.headers.origin}/?profile`,
        email,
        username,
        expires: "in 10 minutes",
        link: emailLink,
        magicLinkToken: emailToken,
      })
      if (phone)
        sendText({
          body: `Click this link to verify your phone on ${websiteSettings.friendlyName}\n\n${phoneLink}\n\nOr copy this token to the login form:\n\n${phoneToken}\n\n`,
          phone,
        })

      res.sendStatus(200)
    }
  } catch (err) {
    console.error(err, req)
    return res.status(500).send(err)
  }
}
