const { mongoConnect, ObjectID } = require("../../mongo")

module.exports = async (req, res) => {
  console.error(new Error("testing error logging"), req)
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
    "geoCoordinates.lat": geoCoordinates.lat,
    "geoCoordinates.lng": geoCoordinates.lng,
    "user._id": user._id,
  }

  // db function
  const fnRateAndReview = async (db, promise) => {
    const reviewCollection = db.collection("Review")
    let existingReview = await reviewCollection
      .findOne(queryKey)
      .catch(() => undefined)
    const throttle = new Date()
    throttle.setDate(throttle.getDate() - 1)
    if (existingReview && existingReview.timestamp > throttle) {
      promise.resolve({
        status: 405,
        error: "You may only rate and review each location once and you can only edit this rating/review once per day.",
      })
    } else {
      existingReview = await reviewCollection.insertOne(review).catch(e => {
        console.error(e, req)
        promise.resolve({ status: 400, error: "Error creating review." })
      })
    }
    if (existingReview) promise.resolve(review)
    else promise.resolve(failedError(400, "Error posting review."))
  }

  // db call
  const savedReview = await mongoConnect(fnRateAndReview)

  return res.send(savedReview)
}
