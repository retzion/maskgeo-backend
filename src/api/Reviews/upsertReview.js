const { mongoConnect, ObjectID } = require("../../mongo")

module.exports = async (req, res) => {
  const {
    body: { geoCoordinates, googlePlaceId, rating, review: reviewText, user },
    jwtData,
  } = req
  const failedError = (status, error) => ({
    status,
    error,
  })

  const valid = jwtData.user._id === user._id
  if (!valid) res.failedError(401, "User ID mismatch.")

  const review = {
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

  // db function
  const fnRateAndReview = async (db, promise) => {
    const reviewCollection = db.collection("Review")
    const existingReviews = await reviewCollection
      .find(queryKey)
      .toArray()
      .catch(() => undefined)

    if (existingReviews.length) {
      const sorted = existingReviews.sort((a, b) => b.timestamp - a.timestamp)
      const userReview = sorted.shift()

      const throttle = new Date()
      throttle.setDate(throttle.getDate() - 1)

      // check that it's been 24 hours since last post
      if (userReview.timestamp > throttle)
        promise.resolve({
          status: 405,
          error:
            "You may only rate and review each location once and you can only edit this rating/review once per day.",
        })
      else {
        // Remove the user's reviews
        await reviewCollection.deleteMany(queryKey).catch(e => {
          console.error(e, req)
          promise.resolve(failedError(400, "Error posting review."))
        })
      }
    }

    // Save the posted review
    const postedReview = await reviewCollection.insertOne(review).catch(e => {
      console.error(e, req)
      promise.resolve({ status: 400, error: "Error creating review." })
    })
    if (postedReview) promise.resolve(review)
    else promise.resolve(failedError(400, "Error posting review."))
  }

  // db call
  const savedReview = await mongoConnect(fnRateAndReview)

  return res.send(savedReview)
}
