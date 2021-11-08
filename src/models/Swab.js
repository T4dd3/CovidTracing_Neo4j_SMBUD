const _ = require('lodash');

function Swab(_node) {
  // I'll create Swab class with the already existing properties of the node Swab
  _.extend(this, _node.properties);

  if (this.date) {
    this.date = Date.parse(this.date);
  }
}

module.exports = Swab;