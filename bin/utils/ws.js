const sendWsMsg = (data, key = 'connected') => JSON.stringify({ data, key })

module.exports = { sendWsMsg }