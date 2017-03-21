'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')
const config = require('config')

const globalSettings = config.get('GLOBAL')
const privateSettings = require('../src/settings/private.settings.json')

let ProcessIncoming = rewire('../src/lib/ProcessIncoming')

describe('[ProcessIncoming]', () => {
    describe('(run)', () => {
        it('should fail on params', (done) => {
            const callback = (success, data) => {
                expect(success).toBe(false)
                expect(data.message).toBeA('string')
                sinon.assert.calledOnce(mockLogger.writeLog)
                done()
            }
            const mockLogger = {
                writeLog: sinon.spy(),
            }
            ProcessIncoming.__set__('Logger', mockLogger)
            ProcessIncoming.run({ junkParam: 1234 }, callback)
        })

    })
})

