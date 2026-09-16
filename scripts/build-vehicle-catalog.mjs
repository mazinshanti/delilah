import {readFile,writeFile} from 'node:fs/promises';
import {BRAND_GROUPS} from '../lib/search-relevance.js';
import {MODEL_GROUPS} from '../lib/search-model-relevance.js';
import {AR_NAMES} from '../public/experience-model.js';
const seed=JSON.parse(await readFile(new URL('../data/catalog-seed.json',import.meta.url)));
const extras={
 Toyota:'Camry|Corolla|Land Cruiser|Land Cruiser Prado|Prado|Yaris|Fortuner|Hilux|RAV4|Avalon|Veloz|Raize|Rush|Highlander|Crown|Supra|86|GR86|Sequoia|Tacoma|Tundra|Innova|Hiace|Coaster|FJ Cruiser|Cressida|Previa|Celica|Prius|bZ4X',
 Nissan:'Patrol|Sunny|Altima|Maxima|Sentra|X-Trail|X-Terra|Xterra|Pathfinder|Kicks|Juke|Micra|Tiida|Armada|Navara|Urvan|GT-R|350Z|370Z|Z|Murano|Leaf|Ariya',
 Hyundai:'Accent|Elantra|Sonata|Azera|Tucson|Santa Fe|Grand Santa Fe|Palisade|Creta|Staria|Stargazer|Kona|Venue|Veloster|Ioniq|Ioniq 5|Ioniq 6|i10|i20|i30|H1|Genesis|Getz|Centennial',
 Kia:'Pegas|Cerato|K3|K4|K5|K8|K9|Sportage|Sorento|Carnival|Seltos|Sonet|Telluride|Stinger|Cadenza|Optima|Rio|Picanto|Mohave|Soul|EV3|EV5|EV6|EV9|Niro',
 Ford:'Territory|Taurus|Explorer|Expedition|Everest|Ranger|F-150|F-250|F-350|Mustang|Mustang Mach-E|Bronco|Bronco Sport|Edge|Flex|Escape|Focus|Fusion|Fiesta|Crown Victoria|Transit|Escort',
 Chevrolet:'Tahoe|Suburban|Captiva|Traverse|Silverado|Camaro|Corvette|Malibu|Impala|Caprice|Lumina|Cruze|Aveo|Spark|Trax|Trailblazer|Blazer|Equinox|Bolt|Groove|Express',
 GMC:'Yukon|Yukon XL|Sierra|Acadia|Terrain|Hummer EV|Savana|Canyon|Envoy',
 Jeep:'Wrangler|Grand Cherokee|Cherokee|Compass|Gladiator|Renegade|Wagoneer|Grand Wagoneer|Liberty|Commander|Patriot',
 Lexus:'ES|IS|LS|RX|NX|LX|GX|UX|GS|RC|LC|CT|LFA|RZ|LBX|TX|SC',
 Mercedes:'A-Class|B-Class|C-Class|E-Class|S-Class|G-Class|CLA|CLS|GLA|GLB|GLC|GLE|GLS|GLK|GL|SL|SLC|SLK|CLK|CL|AMG GT|EQA|EQB|EQC|EQE|EQS|V-Class|Vito|Sprinter',
 BMW:'1 Series|2 Series|3 Series|4 Series|5 Series|6 Series|7 Series|8 Series|X1|X2|X3|X4|X5|X6|X7|XM|Z3|Z4|M2|M3|M4|M5|M6|M8|i3|i4|i5|i7|i8|iX|iX1|iX3',
 'Land Rover':'Range Rover|Range Rover Sport|Range Rover Evoque|Range Rover Velar|Defender|Discovery|Discovery Sport|Freelander',
 Genesis:'G70|G80|G90|GV60|GV70|GV80',Tesla:'Model S|Model 3|Model X|Model Y|Cybertruck|Roadster',
 BYD:'Atto 3|Atto 2|Han|Tang|Seal|Seal U|Sealion 7|Song Plus|Qin Plus|Dolphin|Destroyer 05',
 Geely:'Coolray|Emgrand|Monjaro|Starray|Preface|Tugella|Azkarra|Okavango|GX3 Pro|Geometry C|EX5|EC7|GC6',
 Changan:'CS35|CS35 Plus|CS55|CS55 Plus|CS75|CS75 Plus|CS85|CS95|UNI-K|UNI-T|UNI-V|Eado|Alsvin|Hunter|Lumin',
 MG:'MG 3|MG 4|MG 5|MG 6|MG 7|MG 350|MG 550|MG 750|GT|RX5|RX8|RX9|HS|ZS|One|Whale|Cyberster',
 GAC:'GS3|GS3 Emzoom|GS4|GS5|GS8|GA4|GA6|GA8|Empow|GN6|GN8|M8',
 Jetour:'Dashing|X50|X70|X70 Plus|X90|X90 Plus|T1|T2',Hongqi:'H5|H7|H9|HS3|HS5|HS7|E-HS9|E-QM5',
 Haval:'H2|H6|H7|H8|H9|Jolion|Dargo',Tank:'300|500|700',Exeed:'LX|TXL|VX|RX',
 Chery:'Arrizo 5|Arrizo 6|Arrizo 8|Tiggo 2|Tiggo 4|Tiggo 7|Tiggo 8|Tiggo 9',
 BAIC:'BJ30|BJ40|BJ60|BJ80|X35|X55|X7|D50',JAC:'J4|J7|JS3|JS4|JS6|T6|T8|T9',
 FAW:'Bestune B70|Bestune T33|Bestune T55|Bestune T77|Bestune T99',Bestune:'B70|T33|T55|T77|T99',
 'Great Wall':'Wingle 5|Wingle 7|Poer',Maxus:'D60|D90|G10|G50|G90|T60|T90',
 Omoda:'C5|E5|C7|C9',Jaecoo:'J5|J7|J8',Zeekr:'001|007|009|X|7X',
 'Lynk & Co':'01|02|03|05|06|08|09',Lucid:'Air|Gravity',Polestar:'1|2|3|4',
 Pontiac:'G3|G5|G6|G8|Grand Am|Grand Prix|Firebird|Trans Am|GTO|Bonneville|Sunfire|Solstice|Vibe|Torrent|Montana|Aztek',
 Oldsmobile:'Alero|Aurora|Bravada|Cutlass|Intrigue|Silhouette|Toronado|88|98',Mercury:'Grand Marquis|Marauder|Milan|Mountaineer|Sable|Cougar|Mariner',
 Saturn:'Aura|Ion|Outlook|Sky|Vue|SL|SC|SW',Hummer:'H1|H2|H3',Saab:'9-3|9-5|900|9000|9-7X',
 Daewoo:'Lanos|Nubira|Leganza|Matiz|Espero',Daihatsu:'Terios|Sirion|Charade|Cuore|Rocky|Feroza|Gran Max',
 Acura:'MDX|RDX|TLX|ILX|Integra|NSX|TL|RL|ZDX',Infiniti:'Q30|Q50|Q60|Q70|QX30|QX50|QX55|QX60|QX70|QX80|G35|G37|FX35|FX50',
 Lincoln:'Aviator|Navigator|Nautilus|Corsair|Continental|MKZ|MKX|MKS|Town Car',
 Cadillac:'Escalade|CT4|CT5|CT6|CTS|ATS|DTS|STS|SRX|XT4|XT5|XT6|Lyriq|Celestiq',
 Dodge:'Charger|Challenger|Durango|Journey|Nitro|Caliber|Neon|Viper|Caravan|Ram',Ram:'1500|2500|3500|ProMaster',
 Chrysler:'300|200|Pacifica|Voyager|Town & Country|PT Cruiser|Sebring|Crossfire',
 Foton:'Tunland|View|Toano',JMC:'Vigus|Grand Avenue',Soueast:'DX3|DX5|DX7|S06|S07|S09',
 BAW:'212|BJ212',Mahindra:'Scorpio|XUV700|XUV500|Thar|Bolero',Tata:'Safari|Nexon|Harrier|Tiago|Indica',
 VinFast:'VF 6|VF 7|VF 8|VF 9',Nio:'ET5|ET7|ES6|ES8|EC6|EL6',Xpeng:'P7|G6|G9|X9',
 Deepal:'S07|L07|G318',Leapmotor:'T03|C10|C11|C16',Denza:'D9|N7|Z9',
 Suzuki:'Swift|Dzire|Baleno|Ciaz|Jimny|Vitara|Grand Vitara|Fronx|Ertiga|Celerio|Alto|Carry',
 Isuzu:'D-Max|MU-X|Trooper|Rodeo',Subaru:'Impreza|WRX|Forester|Outback|Legacy|BRZ|Crosstrek|XV|Ascent|Tribeca|Solterra',
 Mitsubishi:'Pajero|Montero Sport|Outlander|ASX|Attrage|L200|Lancer|Galant|Eclipse|Eclipse Cross|Xpander|Mirage',
 Mazda:'2|3|6|CX-3|CX-30|CX-5|CX-50|CX-60|CX-7|CX-8|CX-9|CX-90|MX-5|RX-7|RX-8',
 Honda:'Accord|Civic|City|CR-V|HR-V|Pilot|Odyssey|ZRV|ZR-V|Passport|Ridgeline|Jazz|Fit|S2000|Prelude|CR-Z',
 Bentley:'Continental|Bentayga|Flying Spur|Mulsanne|Arnage|Azure|Brooklands',
 Porsche:'911|718|Boxster|Cayman|Cayenne|Macan|Panamera|Taycan|924|944|928|Carrera GT|918 Spyder',
 Audi:'A1|A3|A4|A5|A6|A7|A8|Q2|Q3|Q5|Q7|Q8|R8|TT|e-tron|e-tron GT|Q4 e-tron|Q6 e-tron|S3|S4|S5|S6|S7|S8|RS3|RS4|RS5|RS6|RS7|RS Q8',
 Volkswagen:'Golf|Passat|Jetta|Polo|Tiguan|Touareg|Teramont|T-Roc|Arteon|Beetle|Scirocco|ID.3|ID.4|ID.6|ID.7|Caddy|Transporter|Amarok',
 Volvo:'XC40|XC60|XC90|S40|S60|S80|S90|V40|V60|V90|C30|C70|EX30|EX90|EX40',
 'Rolls-Royce':'Ghost|Phantom|Cullinan|Wraith|Dawn|Spectre|Silver Shadow|Silver Spirit',
 Ferrari:'296|458|488|812|F8|F12|California|Portofino|Roma|Purosangue|SF90|LaFerrari|F40|F50|Enzo',
 Lamborghini:'Urus|Huracan|Aventador|Gallardo|Murcielago|Diablo|Countach|Revuelto|Temerario',
 McLaren:'570S|570GT|600LT|650S|675LT|720S|750S|765LT|Artura|GT|GTS|P1|Senna|Speedtail',
 'Aston Martin':'DB9|DB11|DB12|DBS|DBX|Vantage|Rapide|Vanquish|Valkyrie',
 Maserati:'Ghibli|Quattroporte|Levante|Grecale|GranTurismo|GranCabrio|MC20',
 MINI:'Cooper|Countryman|Clubman|Paceman|Aceman',Smart:'Fortwo|Forfour|#1|#3',
 Peugeot:'208|308|408|508|2008|3008|5008|Landtrek|Rifter|Traveller',Renault:'Koleos|Duster|Megane|Talisman|Symbol|Captur|Clio|Arkana|Austral',
 Skoda:'Octavia|Superb|Kodiaq|Karoq|Kamiq|Fabia|Scala|Enyaq',Citroen:'C3|C4|C5 Aircross|C5 X|Berlingo|DS3|DS4|DS5',
 Fiat:'500|500X|500L|Tipo|Panda|Punto|Doblo|Ducato|124 Spider',
 'Alfa Romeo':'Giulia|Stelvio|Tonale|Giulietta|159|4C|8C|Brera',
 SEAT:'Ibiza|Leon|Ateca|Arona|Tarraco',Cupra:'Formentor|Leon|Born|Ateca|Tavascan',
 Dacia:'Duster|Sandero|Logan|Jogger|Spring',Opel:'Astra|Corsa|Insignia|Mokka|Grandland|Crossland|Vectra|Omega',
 Jaguar:'XE|XF|XJ|F-Pace|E-Pace|I-Pace|F-Type|X-Type|S-Type|XK',
 Rivian:'R1T|R1S',Lotus:'Elise|Exige|Evora|Emira|Eletre|Emeya',Bugatti:'Veyron|Chiron|Divo|Tourbillon',
 Koenigsegg:'CCX|Agera|Regera|Jesko|Gemera',Pagani:'Zonda|Huayra|Utopia'
};
const aliases={Pontiac:['بونتياك','بونتياق'],Oldsmobile:['اولدزموبيل'],Mercury:['ميركوري'],Saturn:['ساترن'],Hummer:['همر','هامر'],Saab:['ساب'],Acura:['اكورا'],Daihatsu:['دايهاتسو'],Daewoo:['دايو'],Bestune:['بيستون'],Deepal:['ديبال'],Denza:['دينزا'],Rivian:['ريفيان'],Cupra:['كوبرا'],SEAT:['سيات'],Opel:['اوبل'],Dacia:['داسيا'],Lotus:['لوتس'],Bugatti:['بوجاتي'],Koenigsegg:['كونيجسيج'],Pagani:['باجاني'],Mahindra:['ماهيندرا'],Tata:['تاتا'],Nio:['نيو'],Xpeng:['اكس بنج'],Leapmotor:['ليب موتور'],VinFast:['فين فاست'],Smart:['سمارت']};
const rename={'Mercedes-Benz':'Mercedes','Škoda':'Skoda','Citroën':'Citroen','Seat':'SEAT','Mini':'MINI'};
const map=new Map();for(const item of seed){const make=rename[item.brand]||item.brand;map.set(make,new Set(item.models));}
for(const [make,models]of Object.entries(extras)){const set=map.get(make)||new Set();for(const model of models.split('|'))set.add(model);map.set(make,set);}
const norm=s=>String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\u0600-\u06ff]/g,'');
const popular=['Toyota','Lexus','Mercedes','BMW','Nissan','Hyundai','Kia','Ford','Chevrolet','GMC','Jeep','Porsche','Audi','Volkswagen','Land Rover','Genesis','Tesla','BYD','Geely','Changan','MG','GAC','Jetour','Hongqi'];
const makes=[...map].sort(([a],[b])=>(popular.indexOf(a)<0?999:popular.indexOf(a))-(popular.indexOf(b)<0?999:popular.indexOf(b))||a.localeCompare(b)).map(([name,models])=>{
 const unique=new Map();for(const n of models)if(!unique.has(norm(n)))unique.set(norm(n),n);
 return{name,ar:AR_NAMES[name]||BRAND_GROUPS[name]?.find(x=>/[\u0600-\u06ff]/.test(x))||aliases[name]?.[0]||name,aliases:[...new Set([name,...BRAND_GROUPS[name]||[],...aliases[name]||[]])],models:[...unique.values()].map(name=>({name,aliases:[...new Set([name,...Object.entries(MODEL_GROUPS).filter(([k,v])=>norm(k)===norm(name)||v.some(x=>norm(x)===norm(name))).flatMap(([,v])=>v),...(AR_NAMES[name]?[AR_NAMES[name]]:[])])]}))};
});
const catalog={version:2,generatedAt:new Date().toISOString(),sources:['https://github.com/matthlavacka/car-list','Dalelah existing verified source catalog and Saudi-market additions'],makes};
await writeFile(new URL('../public/vehicle-catalog-data.js',import.meta.url),'// Vehicle identity catalog. These are model names, never listings.\nexport const VEHICLE_CATALOG='+JSON.stringify(catalog)+';\n');
console.log({makes:makes.length,models:makes.reduce((n,m)=>n+m.models.length,0)});
