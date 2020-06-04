var config = require('../conf/config');
var objectifier = require('../lib/utils/objectifier');
var builder = require('xmlbuilder');
var request = require('request');
var parseString = require('xml2js').parseString;
var getToken = require('../lib/tokenrequest');
var token;

var url = config.getMarkreglering.url;
var url_token = config.getMarkreglering.url_token;
var consumer_key = config.getMarkreglering.consumer_key;
var consumer_secret = config.getMarkreglering.consumer_secret;
var scope = config.getMarkreglering.scope;

var getMarkreglering = async (req, res) => {
  var objektidentitet;

  await getToken(url_token, consumer_key, consumer_secret, scope)
  .then(JSON.parse)
  .then((result) => {
    token = result.access_token;
  })
  .catch((err) => {
    console.log(err);
  });

  if (objectifier.get('query.ne', req) !== undefined) {
    var ne = objectifier.get('query.ne', req) || '';
    ne = ne.replace(',', ' ');
    var xmlfind = builder.create('soap:Envelope')
      .att('xmlns:soap', 'http://www.w3.org/2003/05/soap-envelope')
      .att('xmlns:v1', 'http://namespace.lantmateriet.se/distribution/produkter/markreglering/v1.5')
      .att('xmlns:ns', 'http://www.opengis.net/gml/3.2')
      .ele('soap:Header')
      .insertAfter('soap:Body')
      .ele('v1:FindMarkregleringRequest')
      .ele('v1:GeometriFilter')
      .ele('v1:Geometri')
      .ele('ns:Point', {
        'ns:id': 'GM_1',
        'srsName': 'EPSG:3010'
      })
      .ele('ns:pos')
      .txt(ne)
      .up()
      .up()
      .up()
      .end({
        pretty: true
      });

    request.post({
      url: url,
      body: xmlfind,
      headers: {
        'Content-Type': 'application/soap+xml',
        'Authorization': `Bearer ${token}`
      }
    },
    function (error, response, body) {
      parseString(body, {
        explicitArray: false,
        ignoreAttrs: true
      }, function (err, result) {
        var markreglering = objectifier.find('app:Markregleringsreferens', result);

        if (markreglering !== undefined) {

          // Skickar enbart förfrågan om det är en plan
          for (var i = 0; i < markreglering.length; i++) {
            if (objectifier.find('app:typ', markreglering[i]) === 'Plan') {
              objektidentitet = objectifier.find('app:objektidentitet', markreglering[i]);
              break;
            }
          }

          if (objektidentitet === undefined) {
            objektidentitet = objectifier.find('app:objektidentitet', result);
          }
          lmMarkreglering(objektidentitet);
        
        } else {
          res.json([])
        }
      });
    });
  } else if (objectifier.get('query.id', req) !== undefined) {
    objektidentitet = objectifier.get('query.id', req);
    lmMarkreglering(objektidentitet);
  }

  function lmMarkreglering(id) {
    var xmlget = builder.create('soap:Envelope')
      .att('xmlns:soap', 'http://www.w3.org/2003/05/soap-envelope')
      .att('xmlns:v1', 'http://namespace.lantmateriet.se/distribution/produkter/markreglering/v1.5')
      .ele('soap:Header')
      .insertAfter('soap:Body')
      .ele('v1:GetMarkregleringRequest')
      .ele('v1:objektidentitet')
      .txt(id)
      .up()
      .ele('v1:IncludeData')
      .ele('v1:total')
      .txt(true)
      .up()
      .up()
      .up()
      .end({
        pretty: true
      });

    request.post({
      url: url,
      body: xmlget,
      headers: {
        'Content-Type': 'application/soap+xml',
        'Authorization': `Bearer ${token}`
      }
    },
    function (error, response, body) {
      parseString(body, {
        explicitArray: false,
        ignoreAttrs: true
      }, function(err, result) {
        res.json(result);
      });
    });
  }
};

module.exports = getMarkreglering;
