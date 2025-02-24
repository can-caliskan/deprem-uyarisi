const dotenv = require('dotenv');
dotenv.config();
const fetch = require('node-fetch');
const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
let twarray = [];



async function checkForEarthquake() {
    try {
        let data = await fetch('https://api.earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson')
            .then(res => res.json());

        if (data.features.length > 0) {
            data.features.forEach(earthquake => {
                let location = earthquake.properties.place;
                let magnitude = earthquake.properties.mag;
                let time = new Date(earthquake.properties.time);
                sendEarthquakeAlert(location, magnitude, time);
            });
        }
    } catch (error) {
        console.log('Deprem verisi hatası:', error);
    }
}

async function sendEarthquakeAlert(location, magnitude, time) {
    try {
        await fetch(process.env.WEBHOOKURL, {
            "method": "POST",
            "headers": { "Content-Type": "application/json" },
            "body": JSON.stringify({
                "content": `Deprem uyarısı: \nYer: ${location} \nBüyüklük: ${magnitude} \nTarih: ${time}`
            })
        });
    } catch (error) {
        console.error('Webhook hatası:', error);
    }
}

async function tw() {
    try {
        let data = await fetch(`https://stream.epctex.com/api/latest?city=all`)
            .then(res => res.json());

        for (let item of data.data) {
            await at(item.full_text, 'https://twitter.com/' + item.user.screen_name + '/status/' + item.id_str, item.id_str);
            await delay(2000);
        }
    } catch (error) {
        console.log('Twitter verisi hatası:', error);
    }
}

function delay(t) {
    return new Promise(resolve => setTimeout(resolve, t));
}

async function at(twadres, twlink, twid) {
    try {
        const response = await openai.createCompletion({
            model: "text-davinci-003",
            prompt: `Please extract the geographic coordinates (latitude and longitude) from the following address and provide a detailed description:\n\n${twadres}\n\nDetailed Address:`,
            temperature: 0,
            max_tokens: 256,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
        });

        var detaylıadres = response.data.choices[0].text.split('Latitude')[0].replace(/\n/g, '');
        var lat = response.data.choices[0].text.split('Latitude')[1].split('Latitude');
        if (lat.length == 1) lat = response.data.choices[0].text.split('Latitude')[1].split(',');
        var latitude = parseFloat(lat[0].match(/\d+\.\d+/)[0]);
        var longitude = parseFloat(lat[1].match(/\d+\.\d+/)[0]);

        if (twarray.includes(twid)) return;
        twarray.push(twid);

        await fetch(process.env.WEBHOOKURL, {
            "method": "POST",
            "headers": { "Content-Type": "application/json" },
            "body": JSON.stringify({
                "content": 'Detaylı adres: ' + detaylıadres + '\nAdrese göre google maps: <https://www.google.com/maps?q=' + encodeURIComponent(detaylıadres) + '>' + '\nKordinat google maps: <https://maps.google.com/?q=' + latitude + ',' + longitude + '&z=8' + '>' + '\nTwitter linki: <' + twlink + '>'
            })
        });
    } catch (error) {
        console.error('OpenAI veya Webhook hatası:', error);
    }
}

checkForEarthquake(); // Deprem kontrolü yapmayı başlat
tw(); // Twitter verilerini işlemeye başla
