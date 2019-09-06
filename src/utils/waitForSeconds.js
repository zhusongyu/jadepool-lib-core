module.exports = (sec = 1) => {
  if (typeof sec !== 'number') sec = 1
  return new Promise((resolve) => setTimeout(resolve, sec * 1000))
}
