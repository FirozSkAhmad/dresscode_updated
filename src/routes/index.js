const InventoryController = require('../controllers/inventory_controller')
const BulkuploadController = require('../controllers/bulkupload_controller')
const EComController = require('../controllers/e-com_controller')

class IndexRoute {
  constructor(expressApp) {
    this.app = expressApp
  }

  async initialize() {
    this.app.use('/inventory', InventoryController)
    this.app.use('/bulkUpload', BulkuploadController)
    this.app.use('/e-com', EComController)
  }
}

module.exports = IndexRoute;
