const { mongoConnect, ObjectID } = require("../../mongo")
const failedError = require("../failedError")

module.exports = async (req, res) => {
  const {
    body: { geoCoordinates, googlePlaceId, rating, review: reviewText, user },
    jwtData,
  } = req

  const valid = jwtData.user._id === user._id
  if (!valid) res.failedError(401, "User ID mismatch.")

  const postedReview = {
    geoCoordinates,
    googlePlaceId,
    rating,
    review: reviewText,
    timestamp: new Date(),
    user: { _id: user._id, username: user.username },
  }

  const queryKey = {
    $or: [{ geoCoordinates }, { googlePlaceId }],
    "user._id": user._id,
  }

  let lastReview

  // db function
  const fnRateAndReview = async (db, promise) => {
    const reviewCollection = db.collection("Review")
    const existingReviews = await reviewCollection
      .find(queryKey)
      .toArray()
      .catch(() => undefined)

    if (existingReviews.length) {
      const sorted = existingReviews.sort((a, b) => b.timestamp - a.timestamp)
      lastReview = sorted.shift()

      const throttle = new Date()
      throttle.setDate(throttle.getDate() - 1)

      // check that it's been 24 hours since last post
      if (lastReview.timestamp > throttle)
        promise.resolve({
          status: 405,
          error:
            "You may only rate and review each location once and you can only edit this rating/review once per day.",
        })
      else if (existingReviews.length > 1) {
        // Remove the user's reviews
        await reviewCollection.deleteMany(queryKey).catch(e => {
          console.error(e, req)
          promise.resolve(failedError(400, "Error editing review."))
        })
      }
    }

    // Save the posted review
    const upsertedReview = await reviewCollection
      .updateOne(queryKey, { $set: postedReview }, { upsert: true })
      .catch(e => {
        console.error(e, req)
        promise.resolve({ status: 400, error: "Error creating review." })
      })
    if (upsertedReview) promise.resolve(postedReview)
    else promise.resolve(failedError(400, "Error saving review."))
  }

  // db call
  const savedReview = await mongoConnect(fnRateAndReview).catch(e => {
    console.error(e, req)
    promise.resolve({ status: 400, error: "Error posting review." })
  })

  return res.send(savedReview)
}
