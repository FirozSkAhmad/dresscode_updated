const AdminController = require('../controllers/admin_controller')

class IndexRoute {
    constructor(expressApp) {
        this.app = expressApp
    }

    async initialize() {
      this.app.use('/admin', AdminController)
    }
}

module.exports = IndexRoute;
