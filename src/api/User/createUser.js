const { sendMail } = require("../../util")
const { mongoConnect } = require("../../mongo")
const createMagicLinkAndHash = require("./createMagicLinkAndHash")

module.exports = async (req, res) => {
  try {
    // destructure parameters
    let {
      body: { email, username },
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
    if (!validUsername)
      return res.status(422).send("Invalid characters found in username.")

    /** Insert the user */
    const userFindKey = {
      $or: [{ username: { $regex: new RegExp(username, "i") } }, { email }],
    }
    const [magicLinkToken, magicLinkTokenHash] = createMagicLinkAndHash()

    // db function
    const fnCreateUser = async (db, promise) => {
      const userCollection = db.collection("User")
      let existingUser = await userCollection
        .findOne(userFindKey)
        .catch(() => undefined)
      if (existingUser) {
        if (existingUser.email === email)
          promise.resolve({error: "Email address already exists."})
        if (existingUser.username.toLowerCase() === username.toLowerCase())
          promise.resolve({error: "Username already exists."})
      } else {
        const magicLinkExpires = new Date()
        magicLinkExpires.setMinutes(magicLinkExpires.getMinutes() + 10)
        existingUser = await userCollection
          .insertOne({ email, username, magicLinkTokenHash, magicLinkExpires })
          .catch(e => {
            console.error(e)
            promise.resolve({error: "Error creating user."})
          })
      }
      if (existingUser) promise.resolve(existingUser)
      else promise.resolve({error: "Error creating user."})
    }

    // db call
    const createdUser = await mongoConnect(fnCreateUser)
      .catch(console.error)

    // send response
    if (!createdUser) return res.sendStatus(500)
    else if (createdUser.error) return res.send(createdUser)
    else {
      /** @DEV Create and email a magic link containing a token to fetch a JWT */
      await sendMail(email, "MaskForecast Magic Link", "new-account", {
        email,
        username,
        expires: "in 10 minutes",
        link: `${req.headers.origin}/token/${magicLinkToken}`,
        buttonBackgroundColor: "cornflowerblue",
        buttonTextColor: "#ffffff",
      })
      res.sendStatus(200)
    }
  } catch (err) {
    console.error(err)
    return res.status(500).send(err)
  }
}

