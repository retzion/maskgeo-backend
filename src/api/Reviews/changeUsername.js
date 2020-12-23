const { mongoConnect, ObjectID } = require("../../mongo")
const failedError = require("../failedError")

module.exports = async (req, res) => {
  const {
    jwtData: { user },
    params: { username }
  } = req

  const queryKey = {
    "user._id": user._id,
  }

  // db function
  const fnChangeReviewUsernames = async (db, promise) => {
    const reviewCollection = db.collection("Review")

    // change username for posted reviews
    const updatedReviews = await reviewCollection
      .updateMany(queryKey, { $set: {"user.username": username} })
      .catch(e => {
        console.error(e, req)
        promise.resolve({ status: 400, error: "Error editing review." })
      })
    if (updatedReviews)
      promise.resolve(updatedReviews)
    else promise.resolve(failedError(400, "Error editing reviews."))
  }

  // db call
  const editedReviews = await mongoConnect(fnChangeReviewUsernames).catch(e => {
    console.error(e, req)
    promise.resolve({ status: 400, error: "Error changing usernames in reviews." })
  })

  return res.send(editedReviews)
}
