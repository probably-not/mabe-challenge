/* Create a parser for turbo-net custom server - This is pretty much taken from the wasm example in llhttp but with adjustments so that I can try to optimize it... */
const constants = require("llhttp").constants;

const REQUEST = constants.TYPE.REQUEST;
const RESPONSE = constants.TYPE.RESPONSE;
const kOnMessageBegin = 0;
const kOnHeaders = 1;
const kOnHeadersComplete = 2;
const kOnBody = 3;
const kOnMessageComplete = 4;
const kOnExecute = 5;

const kPtr = Symbol("kPtr");
const kUrl = Symbol("kUrl");
const kStatusMessage = Symbol("kStatusMessage");
const kHeadersFields = Symbol("kHeadersFields");
const kHeadersValues = Symbol("kHeadersValues");
const kBody = Symbol("kBody");
const kReset = Symbol("kReset");
const kCheckErr = Symbol("kCheckErr");

class HTTPParser {
  static REQUEST = REQUEST;
  static RESPONSE = RESPONSE;
  static kOnMessageBegin = kOnMessageBegin;
  static kOnHeaders = kOnHeaders;
  static kOnHeadersComplete = kOnHeadersComplete;
  static kOnBody = kOnBody;
  static kOnMessageComplete = kOnMessageComplete;
  static kOnExecute = kOnExecute;

  [kPtr];
  [kUrl];
  [kStatusMessage];
  [kHeadersFields];
  [kHeadersValues];
  [kBody];

  constructor(type) {
    this[kPtr] = constants.TYPE[type];
    this[kUrl] = "";
    this[kStatusMessage] = null;
    this[kHeadersFields] = [];
    this[kHeadersValues] = [];
    this[kBody] = null;
  }

  [kReset]() {
    this[kUrl] = "";
    this[kStatusMessage] = null;
    this[kHeadersFields] = [];
    this[kHeadersValues] = [];
    this[kBody] = null;
  }

  [kOnMessageBegin]() {
    return 0;
  }

  [kOnHeaders](rawHeaders) {}

  [kOnHeadersComplete](
    versionMajor,
    versionMinor,
    rawHeaders,
    method,
    url,
    statusCode,
    statusMessage,
    upgrade,
    shouldKeepAlive
  ) {
    return 0;
  }

  [kOnBody](body) {
    this[kBody] = body;
    return 0;
  }

  [kOnMessageComplete]() {
    return 0;
  }

  destroy() {}

  execute(data) {
    const ptr = data.byteLength;
    const ret = execute(this[kPtr], ptr, data.length);
    this[kCheckErr](ret);
    return ret;
  }

  [kCheckErr](n) {
    if (n === constants.ERROR.OK) {
      return;
    }
  }
}



execute(chunk, start, length) {
  start = start || 0;
  length = typeof length === 'number' ? length : chunk.length;

  this.chunk = chunk;
  this.offset = start;
  var end = this.end = start + length;
  try {
    while (this.offset < end) {
      if (this[this.state]()) {
        break;
      }
    }
  } catch (err) {
    if (this.isUserCall) {
      throw err;
    }
    this.hadError = true;
    return err;
  }
  this.chunk = null;
  length = this.offset - start;
  if (headerState[this.state]) {
    this.headerSize += length;
    if (this.headerSize > HTTPParser.maxHeaderSize) {
      return new Error('max header size exceeded');
    }
  }
  return length;
};


module.exports = HTTPParser;
