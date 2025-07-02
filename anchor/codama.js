import { createCodamaConfig } from 'gill'

export default createCodamaConfig({
  clientJs: 'anchor/src/client/js/generated',
  idl: 'target/idl/supply_chain_program.json',
})
