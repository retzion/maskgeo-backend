const crypto = require("crypto")

module.exports = () => {
  const magicLinkToken = crypto.randomBytes(20).toString("hex")
  const magicLinkTokenHash = crypto
    .createHmac("sha256", magicLinkToken)
    .digest("hex")
  return [magicLinkToken, magicLinkTokenHash]
}
