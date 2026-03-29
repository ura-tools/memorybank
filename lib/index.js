'use strict';

const store = require('./store');

module.exports = {
  store: store.store,
  get: store.get,
  update: store.update,
  remove: store.remove,
  list: store.list,
  search: store.search,
  recall: store.recall,
  stats: store.stats,
  namespaces: store.namespaces,
  BASE_DIR: store.BASE_DIR
};
