const _ = require('lodash');

function Activity(_node) {
  // I'll create Activity class with the already existing properties of the node Activity
  _.extend(this, _node.properties);

  if (this.endTime) {
    this.endTime = Date.parse(this.endTime);
  }

  if (this.averageDuration) {
    this.averageDuration = Date.parse(this.averageDuration);
  }
}

module.exports = Activity;