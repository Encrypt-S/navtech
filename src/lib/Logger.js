'use strict'

const nodemailer = require('nodemailer')
const config = require('config')

let globalSettings = config.get('GLOBAL') // eslint-disable-line

let settings = false
if (globalSettings.serverType === 'INCOMING') settings = config.get('INCOMING')
if (globalSettings.serverType === 'OUTGOING') settings = config.get('OUTGOING')

const emailAuth = encodeURIComponent(settings.smtp.user) + ':' + encodeURIComponent(settings.smtp.pass)

const Logger = {}

Logger.transporter = nodemailer.createTransport('smtps://' + emailAuth + '@' + settings.smtp.server)  // eslint-disable-line

// const emailCodes = ['INC_E01']

Logger.writeLog = (errorCode, errorMessage, data, email) => {
  if (email) {
    Logger.sendMail(errorCode, errorMessage, data)
  }
  const date = new Date()
  let logString = '\r\n'
  logString += 'Date: ' + date + '\r\n'
  logString += 'Error Code: ' + errorCode + '\r\n'
  logString += 'Error Message: ' + errorMessage + '\r\n'

  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      let string = data[key]
      if (typeof data[key] === 'object') string = JSON.stringify(data[key])
      logString += key + ': ' + string + '\r\n'
    }
  }
  logString += '\r\n-----------------------------------------------------------\r\n'
  console.log(logString)
}

Logger.sendMail = (errorCode, errorMessage, data) => {
  const mailOptions = {
    from: '"Navtech System" <' + settings.smtp.user + '>',
    to: settings.notificationEmail,
    subject: 'Navtech System Message - ' + settings.local.ipAddress + ' (' + globalSettings.serverType + ') ' + errorCode,
    text: errorCode + ' - ' + errorMessage,
    attachments: [
      {
        filename: 'data.json',
        content: JSON.stringify(data),
      },
    ],
  }

  Logger.transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log('nodemail error', error)
    }
    return console.log('nodemail success: ' + info.response)
  })
}

module.exports = Logger
