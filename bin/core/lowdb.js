const low = require('lowdb')
const { Memory } = require('lowdb/adapters')

const adapter = new Memory()
const db = low(adapter)

module.exports = db