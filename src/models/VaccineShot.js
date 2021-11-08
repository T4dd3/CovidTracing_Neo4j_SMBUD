const _ = require('lodash');

function VaccineShot(_node) {
  // I'll create VaccineShot class with the already existing properties of the node VaccineShot
  _.extend(this, _node.properties);

  if (this.date) {
    this.date = Date.parse(this.date);
  }
}

module.exports = VaccineShot;