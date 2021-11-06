const _ = require('lodash');

function Person(_node) {
  // I'll create Person class with the already existing properties of the node person
  _.extend(this, _node.properties);

  if (this.dateOfBirth) {
    this.dateOfBirth = Date.parse(this.dateOfBirth);
  }
}

module.exports = Person;
