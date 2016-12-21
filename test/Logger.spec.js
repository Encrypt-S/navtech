'use strict'

const expect = require('expect')
const rewire = require('rewire')

let Logger = rewire('../src/lib/Logger')

const errorCode = 'TEST_001'
const errorMessage = 'this is the test error message'
const data = {
  memes: ['harambe', 'rustled jimmies'],
}

describe('[Logger]', () => {
  describe('(writeLog)', () => {
    it('should call the email send function', (done) => {
      Logger.sendMail = (code, message, attachment) => {
        expect(code).toBe(errorCode)
        expect(message).toBe(errorMessage)
        expect(attachment).toBe(data)
        done()
      }
      Logger.writeLog(errorCode, errorMessage, data, true)
    })
  })
  describe('(sendMail)', () => {
    before(() => { // reset the rewired functions
      Logger = rewire('../src/lib/Logger')
    })
    it('should call the mail transport function', (done) => {
      Logger.transporter = {
        sendMail: (options, cb) => {
          cb(null, 'info')
          expect(true).toBe(true)
          done()
        },
      }
      Logger.__set__({ globalSettings: { serverType: 'INCOMING' } })
      Logger.sendMail(errorCode, errorMessage, data)
    })
    it('should call the mail transport function and throw an error', (done) => {
      Logger.transporter = {
        sendMail: (options, cb) => {
          cb('FAILED_TO_SEND_MAIL', 'info')
          expect(true).toBe(true)
          done()
        },
      }
      Logger.__set__({ globalSettings: { serverType: 'OUTGOING' } })
      Logger.sendMail(errorCode, errorMessage, data)
    })
  })
})
