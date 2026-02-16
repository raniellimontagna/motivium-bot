import { parseEnvList } from '../env-utils.js'

describe('#settings/env-utils', () => {
  it('should return empty array when value is undefined', () => {
    expect(parseEnvList(undefined)).toEqual([])
  })

  it('should parse csv values and trim spaces', () => {
    expect(parseEnvList(' id-1, id-2 ,id-3 ')).toEqual(['id-1', 'id-2', 'id-3'])
  })

  it('should remove empty entries', () => {
    expect(parseEnvList('id-1,, ,id-2')).toEqual(['id-1', 'id-2'])
  })
})
