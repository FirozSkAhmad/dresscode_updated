const InventoryController = require('../controllers/inventory_controller')
const BulkuploadController = require('../controllers/bulkupload_controller')

class IndexRoute {
  constructor(expressApp) {
    this.app = expressApp
  }

  async initialize() {
    this.app.use('/inventory', InventoryController)
    this.app.use('/bulkUpload', BulkuploadController)
  }
}

module.exports = IndexRoute;
