const { useState, useEffect, useCallback, useRef, useMemo } = React;

// ── VOCAB DATA (500 cards) — UNCHANGED except hint/diff fields added to select cards ──
const V = {
  "Greetings & Basics": [
    {de:"Hallo",en:"hello",ex:"Hallo, wie geht's?",exEn:"Hello, how are you?",diff:"easy"},{de:"Tschüss",en:"bye",ex:"Tschüss, bis morgen!",exEn:"Bye, see you tomorrow!",diff:"easy"},{de:"Guten Morgen",en:"good morning",ex:"Guten Morgen, Herr Müller.",exEn:"Good morning, Mr Müller.",diff:"easy"},{de:"Guten Tag",en:"good day",ex:"Guten Tag, kann ich Ihnen helfen?",exEn:"Good afternoon, can I help you?",diff:"easy"},{de:"Guten Abend",en:"good evening",ex:"Guten Abend, willkommen!",exEn:"Good evening, welcome!",diff:"easy"},{de:"Gute Nacht",en:"good night",ex:"Gute Nacht, schlaf gut!",exEn:"Good night, sleep well!",diff:"easy"},{de:"Danke",en:"thank you",ex:"Danke für die Hilfe!",exEn:"Thanks for the help!",diff:"easy"},{de:"Bitte",en:"please / you're welcome",ex:"Kann ich bitte ein Wasser haben?",exEn:"Can I please have a water?",diff:"easy"},{de:"ja",en:"yes",ex:"Ja, das stimmt.",exEn:"Yes, that's right.",diff:"easy"},{de:"nein",en:"no",ex:"Nein, das möchte ich nicht.",exEn:"No, I don't want that.",diff:"easy"},{de:"Entschuldigung",en:"excuse me / sorry",ex:"Entschuldigung, wo ist der Bahnhof?",exEn:"Excuse me, where is the station?",diff:"medium",hint:"Ent-SCHULD-igung — related to 'Schuld' (guilt/fault)"},{de:"Wie geht es Ihnen?",en:"how are you? (formal)",ex:"Guten Tag, wie geht es Ihnen?",exEn:"Good afternoon, how are you?",diff:"medium"},{de:"Mir geht es gut",en:"I'm fine",ex:"Mir geht es gut, danke.",exEn:"I'm well, thanks.",diff:"medium"},{de:"Ich heiße …",en:"my name is …",ex:"Ich heiße Jack.",exEn:"My name is Jack.",diff:"easy"},{de:"Wie heißen Sie?",en:"what is your name?",ex:"Wie heißen Sie, bitte?",exEn:"What's your name, please?",diff:"medium"},{de:"Ich komme aus …",en:"I come from …",ex:"Ich komme aus Wales.",exEn:"I'm from Wales.",diff:"easy"},{de:"Ich spreche Englisch",en:"I speak English",ex:"Ich spreche Englisch und ein bisschen Deutsch.",exEn:"I speak English and a bit of German.",diff:"easy"},{de:"Ich verstehe nicht",en:"I don't understand",ex:"Ich verstehe nicht, können Sie das wiederholen?",exEn:"I don't understand, can you repeat?",diff:"medium"},{de:"Können Sie das wiederholen?",en:"can you repeat that?",ex:"Können Sie das bitte wiederholen?",exEn:"Can you repeat that, please?",diff:"hard",hint:"Formal 'you' (Sie) + modal können"},{de:"Sprechen Sie Englisch?",en:"do you speak English?",ex:"Sprechen Sie Englisch?",exEn:"Do you speak English?",diff:"medium"},{de:"bitte schön",en:"here you go",ex:"Bitte schön, Ihr Kaffee.",exEn:"Here you are, your coffee.",diff:"easy"},{de:"genau",en:"exactly",ex:"Ja, genau!",exEn:"Yes, exactly!",diff:"easy"},{de:"natürlich",en:"of course",ex:"Natürlich kannst du mitkommen.",exEn:"Of course you can come along.",diff:"easy"},{de:"willkommen",en:"welcome",ex:"Herzlich willkommen in Berlin!",exEn:"Welcome to Berlin!",diff:"easy"},{de:"auf Wiedersehen",en:"goodbye (formal)",ex:"Auf Wiedersehen und vielen Dank.",exEn:"Goodbye and thank you very much.",diff:"medium",hint:"'auf Wieder-sehen' = 'until again-seeing'"},{de:"Wie bitte?",en:"pardon? / sorry?",ex:"Wie bitte? Das habe ich nicht gehört.",exEn:"Pardon? I didn't hear that.",diff:"easy"},{de:"Es tut mir leid",en:"I'm sorry",ex:"Es tut mir leid, das war mein Fehler.",exEn:"I'm sorry, that was my mistake.",diff:"medium",hint:"Literally: 'It does me suffering'"},{de:"Kein Problem",en:"no problem",ex:"Kein Problem, das mache ich gern.",exEn:"No problem, I'll gladly do it.",diff:"easy"},{de:"Ich bin dran",en:"it's my turn",ex:"Warte, ich bin dran!",exEn:"Wait, it's my turn!",diff:"medium"},{de:"Alles klar",en:"all clear / okay",ex:"Alles klar, dann machen wir das so.",exEn:"All right, let's do it that way.",diff:"easy"},{de:"Schön, dich kennenzulernen",en:"nice to meet you",ex:"Schön, dich kennenzulernen, ich bin Anna.",exEn:"Nice to meet you, I'm Anna.",diff:"hard"},{de:"Sehr angenehm",en:"pleased to meet you (formal)",ex:"Sehr angenehm, Herr Schmidt.",exEn:"Pleased to meet you, Mr Schmidt.",diff:"hard"},{de:"Bis bald",en:"see you soon",ex:"Bis bald, mein Freund!",exEn:"See you soon, my friend!",diff:"easy"},{de:"Bis später",en:"see you later",ex:"Bis später, ich muss los.",exEn:"See you later, I have to go.",diff:"easy"},{de:"Bis morgen",en:"see you tomorrow",ex:"Gute Nacht, bis morgen!",exEn:"Good night, see you tomorrow!",diff:"easy"},{de:"Bis dann",en:"until then",ex:"Wir sehen uns um acht, bis dann.",exEn:"See you at eight, until then.",diff:"easy"},{de:"Schönes Wochenende",en:"have a good weekend",ex:"Tschüss, schönes Wochenende!",exEn:"Bye, have a nice weekend!",diff:"medium"},{de:"Schönen Tag noch",en:"have a nice day",ex:"Schönen Tag noch, auf Wiedersehen.",exEn:"Have a nice day, goodbye.",diff:"medium"},{de:"Mach's gut",en:"take care (informal)",ex:"Mach's gut, wir telefonieren.",exEn:"Take care, we'll talk on the phone.",diff:"medium"},{de:"Viel Glück",en:"good luck",ex:"Viel Glück bei der Prüfung!",exEn:"Good luck with the exam!",diff:"easy"},{de:"Viel Spaß",en:"have fun",ex:"Viel Spaß beim Konzert!",exEn:"Have fun at the concert!",diff:"easy"},{de:"Herzlichen Glückwunsch",en:"congratulations",ex:"Herzlichen Glückwunsch zum Geburtstag!",exEn:"Happy birthday!",diff:"hard"},{de:"Frohe Weihnachten",en:"merry Christmas",ex:"Frohe Weihnachten und ein gutes neues Jahr!",exEn:"Merry Christmas and a happy new year!",diff:"medium"},{de:"Prost",en:"cheers (drinks)",ex:"Prost, auf deine Gesundheit!",exEn:"Cheers, to your health!",diff:"easy"},{de:"Gute Reise",en:"have a good trip",ex:"Gute Reise nach Berlin!",exEn:"Have a good trip to Berlin!",diff:"medium"},{de:"Gesundheit",en:"bless you (sneeze)",ex:"Hatschi! — Gesundheit!",exEn:"Achoo! — Bless you!",diff:"easy"},{de:"Keine Ahnung",en:"no idea",ex:"Wann kommt der Bus? Keine Ahnung.",exEn:"When's the bus coming? No idea.",diff:"medium"},{de:"Stimmt",en:"that's right",ex:"Du hast recht, das stimmt.",exEn:"You're right, that's correct.",diff:"easy"},{de:"Das freut mich",en:"I'm glad",ex:"Du hast bestanden? Das freut mich sehr!",exEn:"You passed? That makes me very happy!",diff:"medium"},{de:"einverstanden",en:"agreed",ex:"Einverstanden, machen wir das so.",exEn:"Agreed, let's do it that way.",diff:"medium"},
  ,
      {de:"Grüß Gott",en:"hello (southern Germany / Austria)",ex:"Grüß Gott, Herr Müller!",exEn:"Hello, Mr Müller! (southern)",diff:"medium",hint:"regional greeting — Bavaria / Austria"},
      {de:"Servus",en:"hi / bye (southern Germany / Austria)",ex:"Servus, wie geht's dir?",exEn:"Hi, how are you? (regional)",diff:"medium",hint:"regional, informal"},
      {de:"Moin",en:"hi (northern Germany)",ex:"Moin! Schönes Wetter heute.",exEn:"Hi! Nice weather today.",diff:"medium",hint:"regional — northern Germany, any time of day"},
      {de:"Macht nichts",en:"it doesn't matter / never mind",ex:"Macht nichts, kein Problem.",exEn:"It doesn't matter, no problem.",diff:"easy"},
      {de:"Freut mich",en:"nice to meet you",ex:"Freut mich, Herr Schmidt.",exEn:"Nice to meet you, Mr Schmidt.",diff:"easy",hint:"short form of 'es freut mich'"}
    ],
  "Numbers & Time": [
    {de:"eins",en:"one",ex:"Ich hätte gern eins.",exEn:"I'd like one.",diff:"easy"},{de:"zwei",en:"two",ex:"Zwei Kaffee, bitte.",exEn:"Two coffees, please.",diff:"easy"},{de:"drei",en:"three",ex:"In drei Tagen bin ich zurück.",exEn:"I'll be back in three days.",diff:"easy"},{de:"vier",en:"four",ex:"Wir sind vier Personen.",exEn:"We are four people.",diff:"easy"},{de:"fünf",en:"five",ex:"Es dauert fünf Minuten.",exEn:"It takes five minutes.",diff:"easy"},{de:"zehn",en:"ten",ex:"Das kostet zehn Euro.",exEn:"That costs ten euros.",diff:"easy"},{de:"zwanzig",en:"twenty",ex:"Ich bin zwanzig Jahre alt.",exEn:"I'm twenty years old.",diff:"easy"},{de:"hundert",en:"hundred",ex:"Das sind hundert Kilometer.",exEn:"That's a hundred kilometres.",diff:"easy"},{de:"tausend",en:"thousand",ex:"Es kostet dreitausend Euro.",exEn:"It costs three thousand euros.",diff:"easy"},{de:"die Uhr",en:"clock / watch",ex:"Wie viel Uhr ist es?",exEn:"What time is it?",diff:"easy"},{de:"die Stunde",en:"hour",ex:"Eine Stunde dauert sechzig Minuten.",exEn:"An hour lasts sixty minutes.",diff:"easy"},{de:"die Minute",en:"minute",ex:"Warte eine Minute.",exEn:"Wait a minute.",diff:"easy"},{de:"heute",en:"today",ex:"Heute ist Montag.",exEn:"Today is Monday.",diff:"easy"},{de:"morgen",en:"tomorrow",ex:"Morgen habe ich frei.",exEn:"Tomorrow I'm off.",diff:"easy"},{de:"gestern",en:"yesterday",ex:"Gestern war ich im Kino.",exEn:"Yesterday I was at the cinema.",diff:"easy"},{de:"jetzt",en:"now",ex:"Ich mache das jetzt.",exEn:"I'm doing it now.",diff:"easy"},{de:"später",en:"later",ex:"Wir reden später.",exEn:"We'll talk later.",diff:"easy"},{de:"früh",en:"early",ex:"Ich stehe immer früh auf.",exEn:"I always get up early.",diff:"easy"},{de:"spät",en:"late",ex:"Es ist schon spät.",exEn:"It's already late.",diff:"easy"},{de:"immer",en:"always",ex:"Er kommt immer pünktlich.",exEn:"He always comes on time.",diff:"easy"},{de:"nie / niemals",en:"never",ex:"Ich esse nie Fisch.",exEn:"I never eat fish.",diff:"easy"},{de:"manchmal",en:"sometimes",ex:"Manchmal gehe ich joggen.",exEn:"Sometimes I go jogging.",diff:"medium"},{de:"oft",en:"often",ex:"Ich gehe oft ins Fitnessstudio.",exEn:"I often go to the gym.",diff:"easy"},{de:"die Woche",en:"week",ex:"Nächste Woche fahre ich nach Berlin.",exEn:"Next week I'm going to Berlin.",diff:"easy"},{de:"der Monat",en:"month",ex:"Dieser Monat hat 30 Tage.",exEn:"This month has 30 days.",diff:"easy"},{de:"das Jahr",en:"year",ex:"Letztes Jahr war ich in Sofia.",exEn:"Last year I was in Sofia.",diff:"easy"},{de:"der Tag",en:"day",ex:"Heute ist ein schöner Tag.",exEn:"Today is a beautiful day.",diff:"easy"},{de:"die Nacht",en:"night",ex:"In der Nacht ist es kalt.",exEn:"At night it's cold.",diff:"easy"},{de:"der Morgen",en:"morning",ex:"Am Morgen trinke ich Kaffee.",exEn:"In the morning I drink coffee.",diff:"easy"},{de:"der Abend",en:"evening",ex:"Am Abend gehe ich spazieren.",exEn:"In the evening I go for a walk.",diff:"easy"},{de:"sechs",en:"six",ex:"Wir sind sechs Personen.",exEn:"We are six people.",diff:"easy"},{de:"sieben",en:"seven",ex:"Die Woche hat sieben Tage.",exEn:"The week has seven days.",diff:"easy"},{de:"acht",en:"eight",ex:"Der Film beginnt um acht.",exEn:"The film starts at eight.",diff:"easy"},{de:"neun",en:"nine",ex:"Ich arbeite bis neun Uhr.",exEn:"I work until nine o'clock.",diff:"easy"},{de:"elf",en:"eleven",ex:"Das Kind ist elf Jahre alt.",exEn:"The child is eleven years old.",diff:"easy"},{de:"zwölf",en:"twelve",ex:"Um zwölf Uhr ist Mittag.",exEn:"Noon is at twelve o'clock.",diff:"easy"},{de:"dreißig",en:"thirty",ex:"Ich bin dreißig Jahre alt.",exEn:"I'm thirty years old.",diff:"medium",hint:"ß, not ss — note the sharp s"},{de:"vierzig",en:"forty",ex:"Er arbeitet vierzig Stunden die Woche.",exEn:"He works forty hours a week.",diff:"easy"},{de:"fünfzig",en:"fifty",ex:"Das kostet fünfzig Euro.",exEn:"That costs fifty euros.",diff:"easy"},{de:"der Montag",en:"Monday",ex:"Am Montag beginnt die Arbeitswoche.",exEn:"The work week starts on Monday.",diff:"easy"},{de:"der Dienstag",en:"Tuesday",ex:"Dienstag habe ich Deutschkurs.",exEn:"On Tuesday I have German class.",diff:"easy"},{de:"der Mittwoch",en:"Wednesday",ex:"Mittwoch ist in der Mitte der Woche.",exEn:"Wednesday is in the middle of the week.",diff:"medium",hint:"Mitt (middle) + Woche (week)"},{de:"der Donnerstag",en:"Thursday",ex:"Donnerstag gehe ich ins Fitnessstudio.",exEn:"On Thursday I go to the gym.",diff:"medium"},{de:"der Freitag",en:"Friday",ex:"Endlich Freitag!",exEn:"Finally Friday!",diff:"easy"},{de:"der Samstag",en:"Saturday",ex:"Samstag schlafe ich lange.",exEn:"I sleep in on Saturday.",diff:"easy"},{de:"der Sonntag",en:"Sunday",ex:"Sonntag ist mein Ruhetag.",exEn:"Sunday is my rest day.",diff:"easy"},{de:"halb",en:"half",ex:"Es ist halb acht.",exEn:"It's half past seven.",diff:"easy",hint:"halb acht = 7:30 (not 8:30!)"},{de:"das Viertel",en:"quarter",ex:"Viertel nach zwei.",exEn:"Quarter past two.",diff:"medium"},{de:"morgens",en:"in the morning",ex:"Morgens trinke ich Kaffee.",exEn:"In the mornings I drink coffee.",diff:"easy"},{de:"abends",en:"in the evening",ex:"Abends lese ich ein Buch.",exEn:"In the evenings I read a book.",diff:"easy"},
  ],
  "Family & People": [
    {de:"der Mann",en:"man / husband",ex:"Der Mann liest die Zeitung.",exEn:"The man is reading the newspaper.",diff:"easy"},{de:"die Frau",en:"woman / wife",ex:"Die Frau arbeitet im Büro.",exEn:"The woman works at the office.",diff:"easy"},{de:"das Kind",en:"child",ex:"Das Kind spielt im Garten.",exEn:"The child is playing in the garden.",diff:"easy"},{de:"der Junge",en:"boy",ex:"Der Junge geht zur Schule.",exEn:"The boy goes to school.",diff:"easy"},{de:"das Mädchen",en:"girl",ex:"Das Mädchen lacht laut.",exEn:"The girl is laughing loudly.",diff:"easy",hint:"das — neuter despite meaning 'girl' (-chen suffix always neuter)"},{de:"die Mutter",en:"mother",ex:"Meine Mutter kocht gern.",exEn:"My mother likes to cook.",diff:"easy"},{de:"der Vater",en:"father",ex:"Mein Vater arbeitet viel.",exEn:"My father works a lot.",diff:"easy"},{de:"die Eltern",en:"parents",ex:"Meine Eltern wohnen in Wales.",exEn:"My parents live in Wales.",diff:"easy"},{de:"der Bruder",en:"brother",ex:"Mein Bruder ist älter als ich.",exEn:"My brother is older than me.",diff:"easy"},{de:"die Schwester",en:"sister",ex:"Meine Schwester studiert Medizin.",exEn:"My sister studies medicine.",diff:"easy"},{de:"die Familie",en:"family",ex:"Die Familie isst zusammen.",exEn:"The family eats together.",diff:"easy"},{de:"der Freund",en:"friend (m) / boyfriend",ex:"Mein Freund kommt aus Deutschland.",exEn:"My friend comes from Germany.",diff:"easy"},{de:"die Freundin",en:"friend (f) / girlfriend",ex:"Meine Freundin spricht Deutsch.",exEn:"My girlfriend speaks German.",diff:"easy"},{de:"die Leute",en:"people",ex:"Die Leute sind sehr nett hier.",exEn:"The people are very nice here.",diff:"easy"},{de:"der Nachbar",en:"neighbour",ex:"Mein Nachbar hat einen Hund.",exEn:"My neighbour has a dog.",diff:"medium"},{de:"das Baby",en:"baby",ex:"Das Baby schläft gerade.",exEn:"The baby is sleeping right now.",diff:"easy"},{de:"der Großvater",en:"grandfather",ex:"Mein Großvater ist 80 Jahre alt.",exEn:"My grandfather is 80 years old.",diff:"medium"},{de:"die Großmutter",en:"grandmother",ex:"Meine Großmutter backt Kuchen.",exEn:"My grandmother bakes cakes.",diff:"medium"},{de:"der Onkel",en:"uncle",ex:"Mein Onkel lebt in München.",exEn:"My uncle lives in Munich.",diff:"easy"},{de:"die Tante",en:"aunt",ex:"Meine Tante kommt morgen.",exEn:"My aunt is coming tomorrow.",diff:"easy"},{de:"der Chef",en:"boss",ex:"Mein Chef ist streng.",exEn:"My boss is strict.",diff:"easy"},{de:"der Kollege",en:"colleague (m)",ex:"Mein Kollege hilft mir oft.",exEn:"My colleague often helps me.",diff:"medium"},{de:"der Mensch",en:"person / human being",ex:"Jeder Mensch ist anders.",exEn:"Every person is different.",diff:"medium"},{de:"die Gruppe",en:"group",ex:"Wir arbeiten in einer Gruppe.",exEn:"We work in a group.",diff:"easy"},{de:"der Gast",en:"guest",ex:"Der Gast kommt um acht.",exEn:"The guest is coming at eight.",diff:"easy"},{de:"der Sohn",en:"son",ex:"Mein Sohn geht zur Schule.",exEn:"My son goes to school.",diff:"easy"},{de:"die Tochter",en:"daughter",ex:"Meine Tochter ist fünf.",exEn:"My daughter is five.",diff:"easy"},{de:"das Paar",en:"couple / pair",ex:"Das Paar geht spazieren.",exEn:"The couple is going for a walk.",diff:"easy"},{de:"die Beziehung",en:"relationship",ex:"Sie haben eine gute Beziehung.",exEn:"They have a good relationship.",diff:"medium"},{de:"der Verwandte",en:"relative",ex:"Meine Verwandten leben in London.",exEn:"My relatives live in London.",diff:"hard",hint:"verwandt = related; der Verwandte declines like an adjective"},{de:"der Cousin",en:"cousin (m)",ex:"Mein Cousin wohnt in Hamburg.",exEn:"My cousin lives in Hamburg.",diff:"easy"},{de:"die Cousine",en:"cousin (f)",ex:"Meine Cousine ist Ärztin.",exEn:"My cousin is a doctor.",diff:"easy"},{de:"der Neffe",en:"nephew",ex:"Mein Neffe ist fünf Jahre alt.",exEn:"My nephew is five years old.",diff:"medium"},{de:"die Nichte",en:"niece",ex:"Ich besuche meine Nichte.",exEn:"I'm visiting my niece.",diff:"medium"},{de:"der Enkel",en:"grandson",ex:"Mein Enkel lernt lesen.",exEn:"My grandson is learning to read.",diff:"medium"},{de:"die Enkelin",en:"granddaughter",ex:"Meine Enkelin spielt Klavier.",exEn:"My granddaughter plays piano.",diff:"medium"},{de:"die Geschwister",en:"siblings",ex:"Ich habe zwei Geschwister.",exEn:"I have two siblings.",diff:"medium"},{de:"der Ehemann",en:"husband",ex:"Ihr Ehemann arbeitet im Ausland.",exEn:"Her husband works abroad.",diff:"medium"},{de:"die Ehefrau",en:"wife",ex:"Seine Ehefrau heißt Sabine.",exEn:"His wife's name is Sabine.",diff:"medium"},{de:"der Schwager",en:"brother-in-law",ex:"Mein Schwager ist sehr nett.",exEn:"My brother-in-law is very nice.",diff:"hard"},{de:"die Schwägerin",en:"sister-in-law",ex:"Meine Schwägerin kocht gern.",exEn:"My sister-in-law likes cooking.",diff:"hard"},{de:"der Stiefvater",en:"stepfather",ex:"Mein Stiefvater ist wie ein Vater für mich.",exEn:"My stepfather is like a father to me.",diff:"medium"},{de:"die Stiefmutter",en:"stepmother",ex:"Seine Stiefmutter ist sehr freundlich.",exEn:"His stepmother is very friendly.",diff:"medium"},{de:"der Zwilling",en:"twin",ex:"Sie sind Zwillinge.",exEn:"They are twins.",diff:"medium"},{de:"der Fremde",en:"stranger",ex:"Sprich nicht mit Fremden.",exEn:"Don't talk to strangers.",diff:"medium"},{de:"der Bekannte",en:"acquaintance",ex:"Er ist nur ein Bekannter, kein Freund.",exEn:"He's just an acquaintance, not a friend.",diff:"hard"},{de:"der Erwachsene",en:"adult",ex:"Erwachsene zahlen mehr als Kinder.",exEn:"Adults pay more than children.",diff:"hard"},{de:"der Jugendliche",en:"teenager",ex:"Jugendliche nutzen viel Social Media.",exEn:"Teenagers use a lot of social media.",diff:"hard"},{de:"der Rentner",en:"retiree",ex:"Mein Großvater ist seit Januar Rentner.",exEn:"My grandfather has been retired since January.",diff:"hard"},{de:"die Persönlichkeit",en:"personality",ex:"Sie hat eine starke Persönlichkeit.",exEn:"She has a strong personality.",diff:"hard"},
  ,
      {de:"der Partner",en:"partner",ex:"Mein Partner arbeitet im Krankenhaus.",exEn:"My partner works at the hospital.",diff:"easy"},
      {de:"die Partnerin",en:"partner (female)",ex:"Sie stellt mir ihre Partnerin vor.",exEn:"She's introducing her partner.",diff:"easy"},
      {de:"der Verlobte",en:"fiancé",ex:"Ihr Verlobter heißt Max.",exEn:"Her fiancé is called Max.",diff:"medium"},
      {de:"ledig",en:"single (unmarried)",ex:"Ich bin noch ledig.",exEn:"I'm still single.",diff:"medium"},
      {de:"verheiratet",en:"married",ex:"Sie sind seit zehn Jahren verheiratet.",exEn:"They've been married for ten years.",diff:"easy"}
    ],
  "Food & Drink": [
    {de:"das Wasser",en:"water",ex:"Kann ich ein Glas Wasser haben?",exEn:"Can I have a glass of water?",diff:"easy"},{de:"der Kaffee",en:"coffee",ex:"Ich trinke morgens immer Kaffee.",exEn:"I always drink coffee in the morning.",diff:"easy"},{de:"der Tee",en:"tea",ex:"Möchtest du Tee oder Kaffee?",exEn:"Would you like tea or coffee?",diff:"easy"},{de:"das Bier",en:"beer",ex:"Ein Bier, bitte!",exEn:"One beer, please!",diff:"easy"},{de:"der Wein",en:"wine",ex:"Der Rotwein ist sehr gut.",exEn:"The red wine is very good.",diff:"easy"},{de:"die Milch",en:"milk",ex:"Ich nehme Milch in meinen Kaffee.",exEn:"I take milk in my coffee.",diff:"easy"},{de:"der Saft",en:"juice",ex:"Einen Orangensaft, bitte.",exEn:"One orange juice, please.",diff:"easy"},{de:"das Brot",en:"bread",ex:"Ich kaufe frisches Brot.",exEn:"I'm buying fresh bread.",diff:"easy"},{de:"das Brötchen",en:"bread roll",ex:"Zum Frühstück esse ich ein Brötchen.",exEn:"I have a roll for breakfast.",diff:"easy",hint:"Brot + -chen (small bread)"},{de:"die Butter",en:"butter",ex:"Brot mit Butter, bitte.",exEn:"Bread with butter, please.",diff:"easy"},{de:"der Käse",en:"cheese",ex:"Ich mag Käse sehr gern.",exEn:"I really like cheese.",diff:"easy"},{de:"die Wurst",en:"sausage",ex:"Die Bratwurst ist typisch deutsch.",exEn:"Bratwurst is typically German.",diff:"easy"},{de:"das Fleisch",en:"meat",ex:"Ich esse nicht viel Fleisch.",exEn:"I don't eat much meat.",diff:"easy"},{de:"das Hähnchen",en:"chicken",ex:"Hähnchen mit Reis, bitte.",exEn:"Chicken with rice, please.",diff:"medium"},{de:"der Fisch",en:"fish",ex:"Der Fisch ist frisch.",exEn:"The fish is fresh.",diff:"easy"},{de:"das Ei",en:"egg",ex:"Ich möchte zwei Eier zum Frühstück.",exEn:"I'd like two eggs for breakfast.",diff:"easy",hint:"Plural: Eier"},{de:"der Reis",en:"rice",ex:"Ich koche Reis zum Abendessen.",exEn:"I'm cooking rice for dinner.",diff:"easy"},{de:"die Kartoffel",en:"potato",ex:"Kartoffeln mit Salat, bitte.",exEn:"Potatoes with salad, please.",diff:"medium"},{de:"das Gemüse",en:"vegetables",ex:"Ich esse viel Gemüse.",exEn:"I eat lots of vegetables.",diff:"medium"},{de:"das Obst",en:"fruit",ex:"Obst ist gesund.",exEn:"Fruit is healthy.",diff:"medium"},{de:"der Apfel",en:"apple",ex:"Ich esse jeden Tag einen Apfel.",exEn:"I eat an apple every day.",diff:"easy"},{de:"die Tomate",en:"tomato",ex:"Die Tomaten sind reif.",exEn:"The tomatoes are ripe.",diff:"easy"},{de:"der Salat",en:"salad / lettuce",ex:"Einen gemischten Salat, bitte.",exEn:"A mixed salad, please.",diff:"easy"},{de:"die Suppe",en:"soup",ex:"Die Suppe ist heiß.",exEn:"The soup is hot.",diff:"easy"},{de:"der Kuchen",en:"cake",ex:"Der Kuchen schmeckt lecker.",exEn:"The cake tastes delicious.",diff:"easy"},{de:"die Schokolade",en:"chocolate",ex:"Ich liebe Schokolade.",exEn:"I love chocolate.",diff:"easy"},{de:"das Essen",en:"food / meal",ex:"Das Essen war ausgezeichnet.",exEn:"The food was excellent.",diff:"easy"},{de:"das Frühstück",en:"breakfast",ex:"Was gibt es zum Frühstück?",exEn:"What's for breakfast?",diff:"medium",hint:"früh (early) + Stück (piece)"},{de:"das Mittagessen",en:"lunch",ex:"Um zwölf Uhr gibt es Mittagessen.",exEn:"Lunch is at twelve o'clock.",diff:"medium"},{de:"das Abendessen",en:"dinner",ex:"Was machen wir zum Abendessen?",exEn:"What are we having for dinner?",diff:"medium"},{de:"die Rechnung",en:"bill",ex:"Die Rechnung, bitte.",exEn:"The bill, please.",diff:"medium"},{de:"lecker",en:"delicious / tasty",ex:"Das war sehr lecker!",exEn:"That was very delicious!",diff:"easy"},{de:"das Restaurant",en:"restaurant",ex:"Wir gehen heute ins Restaurant.",exEn:"We're going to a restaurant today.",diff:"easy"},{de:"der Teller",en:"plate",ex:"Der Teller ist leer.",exEn:"The plate is empty.",diff:"easy"},{de:"das Glas",en:"glass",ex:"Ein Glas Wasser, bitte.",exEn:"A glass of water, please.",diff:"easy"},{de:"der Joghurt",en:"yoghurt",ex:"Ich esse jeden Morgen Joghurt.",exEn:"I eat yoghurt every morning.",diff:"easy"},{de:"das Müsli",en:"muesli",ex:"Müsli mit Milch zum Frühstück.",exEn:"Muesli with milk for breakfast.",diff:"easy"},{de:"die Marmelade",en:"jam",ex:"Brot mit Erdbeermarmelade.",exEn:"Bread with strawberry jam.",diff:"medium"},{de:"der Honig",en:"honey",ex:"Ich nehme Honig in meinen Tee.",exEn:"I take honey in my tea.",diff:"easy"},{de:"der Zucker",en:"sugar",ex:"Eine Tasse Kaffee ohne Zucker, bitte.",exEn:"A cup of coffee without sugar, please.",diff:"easy"},{de:"das Salz",en:"salt",ex:"Das Essen braucht mehr Salz.",exEn:"The food needs more salt.",diff:"easy"},{de:"der Pfeffer",en:"pepper (spice)",ex:"Salz und Pfeffer, bitte.",exEn:"Salt and pepper, please.",diff:"easy"},{de:"das Öl",en:"oil",ex:"Olivenöl ist gesund.",exEn:"Olive oil is healthy.",diff:"easy"},{de:"der Essig",en:"vinegar",ex:"Salat mit Öl und Essig.",exEn:"Salad with oil and vinegar.",diff:"medium"},{de:"die Banane",en:"banana",ex:"Ich esse täglich eine Banane.",exEn:"I eat a banana daily.",diff:"easy"},{de:"die Orange",en:"orange",ex:"Die Orange ist süß.",exEn:"The orange is sweet.",diff:"easy"},{de:"die Erdbeere",en:"strawberry",ex:"Erdbeeren mit Sahne.",exEn:"Strawberries with cream.",diff:"medium",hint:"Erde (earth) + Beere (berry)"},{de:"die Zitrone",en:"lemon",ex:"Tee mit Zitrone.",exEn:"Tea with lemon.",diff:"easy"},{de:"die Gurke",en:"cucumber",ex:"Ich mag Gurken im Salat.",exEn:"I like cucumbers in salad.",diff:"easy"},{de:"die Zwiebel",en:"onion",ex:"Die Zwiebel macht mich weinen.",exEn:"The onion makes me cry.",diff:"easy"},{de:"der Knoblauch",en:"garlic",ex:"Ich koche gern mit Knoblauch.",exEn:"I like cooking with garlic.",diff:"medium"},{de:"die Pilze",en:"mushrooms",ex:"Pilze sammeln im Wald.",exEn:"Picking mushrooms in the forest.",diff:"medium"},{de:"die Nudeln",en:"pasta",ex:"Nudeln mit Tomatensoße.",exEn:"Noodles with tomato sauce.",diff:"easy"},{de:"die Pizza",en:"pizza",ex:"Eine Pizza Margherita, bitte.",exEn:"One pizza Margherita, please.",diff:"easy"},{de:"die Flasche",en:"bottle",ex:"Eine Flasche Wasser, bitte.",exEn:"A bottle of water, please.",diff:"easy"},
  ,
      {de:"die Mahlzeit",en:"meal",ex:"Guten Appetit und eine schöne Mahlzeit!",exEn:"Enjoy your meal and a nice mealtime!",diff:"medium"},
      {de:"die Vorspeise",en:"starter / appetizer",ex:"Als Vorspeise nehme ich Suppe.",exEn:"I'll have soup as a starter.",diff:"medium"},
      {de:"das Hauptgericht",en:"main course",ex:"Das Hauptgericht war ausgezeichnet.",exEn:"The main course was excellent.",diff:"medium"},
      {de:"die Nachspeise",en:"dessert",ex:"Als Nachspeise gibt es Eis.",exEn:"There's ice cream for dessert.",diff:"medium"},
      {de:"die Speisekarte",en:"menu",ex:"Die Speisekarte, bitte!",exEn:"The menu, please!",diff:"easy"}
    ],
  "Around the House": [
    {de:"das Haus",en:"house",ex:"Das Haus ist groß.",exEn:"The house is big.",diff:"easy"},{de:"die Wohnung",en:"flat / apartment",ex:"Meine Wohnung hat drei Zimmer.",exEn:"My flat has three rooms.",diff:"medium"},{de:"das Zimmer",en:"room",ex:"Das Zimmer ist hell und warm.",exEn:"The room is bright and warm.",diff:"easy"},{de:"die Küche",en:"kitchen",ex:"Ich koche in der Küche.",exEn:"I cook in the kitchen.",diff:"easy"},{de:"das Bad",en:"bathroom",ex:"Das Bad ist klein.",exEn:"The bathroom is small.",diff:"easy"},{de:"das Schlafzimmer",en:"bedroom",ex:"Das Schlafzimmer ist oben.",exEn:"The bedroom is upstairs.",diff:"medium",hint:"Schlaf (sleep) + Zimmer (room)"},{de:"der Garten",en:"garden",ex:"Die Kinder spielen im Garten.",exEn:"The children are playing in the garden.",diff:"easy"},{de:"die Tür",en:"door",ex:"Bitte mach die Tür zu.",exEn:"Please close the door.",diff:"easy"},{de:"das Fenster",en:"window",ex:"Kannst du das Fenster öffnen?",exEn:"Can you open the window?",diff:"easy"},{de:"der Tisch",en:"table",ex:"Das Essen steht auf dem Tisch.",exEn:"The food is on the table.",diff:"easy"},{de:"der Stuhl",en:"chair",ex:"Setz dich auf den Stuhl.",exEn:"Sit down on the chair.",diff:"easy"},{de:"das Bett",en:"bed",ex:"Ich gehe ins Bett.",exEn:"I'm going to bed.",diff:"easy"},{de:"der Schrank",en:"cupboard / wardrobe",ex:"Die Kleidung ist im Schrank.",exEn:"The clothes are in the wardrobe.",diff:"medium"},{de:"die Lampe",en:"lamp",ex:"Mach bitte die Lampe an.",exEn:"Please turn on the lamp.",diff:"easy"},{de:"der Schlüssel",en:"key",ex:"Wo ist mein Schlüssel?",exEn:"Where is my key?",diff:"medium",hint:"schließen (to close/lock) → Schlüssel"},{de:"die Treppe",en:"stairs",ex:"Geh die Treppe hoch.",exEn:"Go up the stairs.",diff:"medium"},{de:"der Boden",en:"floor / ground",ex:"Der Boden ist sauber.",exEn:"The floor is clean.",diff:"medium"},{de:"die Wand",en:"wall",ex:"Das Bild hängt an der Wand.",exEn:"The picture is hanging on the wall.",diff:"easy"},{de:"das Sofa",en:"sofa",ex:"Ich sitze auf dem Sofa.",exEn:"I'm sitting on the sofa.",diff:"easy"},{de:"der Kühlschrank",en:"fridge",ex:"Die Milch ist im Kühlschrank.",exEn:"The milk is in the fridge.",diff:"hard",hint:"kühl (cool) + Schrank (cupboard)"},{de:"die Dusche",en:"shower",ex:"Ich gehe unter die Dusche.",exEn:"I'm taking a shower.",diff:"easy"},{de:"der Spiegel",en:"mirror",ex:"Ich schaue in den Spiegel.",exEn:"I'm looking in the mirror.",diff:"medium"},{de:"die Heizung",en:"heating",ex:"Die Heizung ist an.",exEn:"The heating is on.",diff:"medium",hint:"heizen (to heat) + -ung (noun suffix)"},{de:"der Fernseher",en:"television",ex:"Wir schauen Fernseher.",exEn:"We're watching TV.",diff:"medium",hint:"fern (far) + sehen (to see) = far-seer"},{de:"die Waschmaschine",en:"washing machine",ex:"Die Waschmaschine ist kaputt.",exEn:"The washing machine is broken.",diff:"hard",hint:"waschen (wash) + Maschine (machine)"},{de:"der Balkon",en:"balcony",ex:"Ich trinke Kaffee auf dem Balkon.",exEn:"I drink coffee on the balcony.",diff:"easy"},{de:"der Keller",en:"basement / cellar",ex:"Die Werkzeuge sind im Keller.",exEn:"The tools are in the cellar.",diff:"medium"},{de:"das Dach",en:"roof",ex:"Das Dach muss repariert werden.",exEn:"The roof needs to be repaired.",diff:"medium"},{de:"der Hof",en:"yard / courtyard",ex:"Die Kinder spielen im Hof.",exEn:"The children play in the courtyard.",diff:"medium"},{de:"die Steckdose",en:"power socket",ex:"Wo ist die nächste Steckdose?",exEn:"Where is the nearest socket?",diff:"hard",hint:"stecken (to plug) + Dose (box)"},{de:"der Topf",en:"pot",ex:"Der Topf steht auf dem Herd.",exEn:"The pot is on the stove.",diff:"easy"},{de:"die Pfanne",en:"pan",ex:"Brate das Ei in der Pfanne.",exEn:"Fry the egg in the pan.",diff:"easy"},{de:"das Messer",en:"knife",ex:"Das Messer ist sehr scharf.",exEn:"The knife is very sharp.",diff:"easy"},{de:"die Gabel",en:"fork",ex:"Ich esse mit Messer und Gabel.",exEn:"I eat with knife and fork.",diff:"easy"},{de:"der Löffel",en:"spoon",ex:"Ein Löffel Zucker, bitte.",exEn:"A spoon of sugar, please.",diff:"easy"},{de:"die Schere",en:"scissors",ex:"Wo ist die Schere?",exEn:"Where are the scissors?",diff:"medium"},{de:"das Regal",en:"shelf",ex:"Die Bücher stehen im Regal.",exEn:"The books are on the shelf.",diff:"easy"},{de:"der Teppich",en:"carpet",ex:"Der Teppich ist weich.",exEn:"The carpet is soft.",diff:"easy"},{de:"die Decke",en:"blanket / ceiling",ex:"Die Decke ist warm.",exEn:"The blanket is warm.",diff:"easy",hint:"Decke = both blanket AND ceiling"},{de:"das Kissen",en:"pillow",ex:"Mein Kissen ist zu hart.",exEn:"My pillow is too hard.",diff:"easy"},{de:"der Wasserhahn",en:"tap",ex:"Mach den Wasserhahn zu!",exEn:"Turn off the tap!",diff:"hard",hint:"Wasser (water) + Hahn (rooster/tap)"},{de:"die Seife",en:"soap",ex:"Bitte wasch deine Hände mit Seife.",exEn:"Please wash your hands with soap.",diff:"easy"},{de:"das Handtuch",en:"towel",ex:"Ich brauche ein sauberes Handtuch.",exEn:"I need a clean towel.",diff:"easy",hint:"Hand + Tuch (cloth)"},{de:"der Mülleimer",en:"rubbish bin",ex:"Der Mülleimer ist voll.",exEn:"The bin is full.",diff:"hard",hint:"Müll (rubbish) + Eimer (bucket)"},{de:"die Zahnbürste",en:"toothbrush",ex:"Ich putze zweimal täglich mit der Zahnbürste.",exEn:"I brush twice daily with my toothbrush.",diff:"hard",hint:"Zahn (tooth) + Bürste (brush)"},
  ,
      {de:"das Wohnzimmer",en:"living room",ex:"Wir sitzen im Wohnzimmer.",exEn:"We sit in the living room.",diff:"easy"},
      {de:"der Flur",en:"hallway",ex:"Der Flur ist sehr lang.",exEn:"The hallway is very long.",diff:"medium"},
      {de:"die Toilette",en:"toilet",ex:"Wo ist die Toilette, bitte?",exEn:"Where is the toilet, please?",diff:"easy"},
      {de:"das Waschbecken",en:"sink",ex:"Das Waschbecken ist verstopft.",exEn:"The sink is clogged.",diff:"medium"},
      {de:"der Kleiderschrank",en:"wardrobe",ex:"Meine Kleidung ist im Kleiderschrank.",exEn:"My clothes are in the wardrobe.",diff:"medium"}
    ],
  "Body & Health": [
    {de:"der Kopf",en:"head",ex:"Mir tut der Kopf weh.",exEn:"My head hurts.",diff:"easy"},{de:"das Auge",en:"eye",ex:"Sie hat blaue Augen.",exEn:"She has blue eyes.",diff:"easy"},{de:"die Nase",en:"nose",ex:"Meine Nase läuft.",exEn:"My nose is running.",diff:"easy"},{de:"der Mund",en:"mouth",ex:"Mach den Mund auf.",exEn:"Open your mouth.",diff:"easy"},{de:"das Ohr",en:"ear",ex:"Ich habe Ohrenschmerzen.",exEn:"I have earache.",diff:"easy"},{de:"die Hand",en:"hand",ex:"Gib mir deine Hand.",exEn:"Give me your hand.",diff:"easy"},{de:"der Finger",en:"finger",ex:"Ich habe mir in den Finger geschnitten.",exEn:"I cut my finger.",diff:"easy"},{de:"der Fuß",en:"foot",ex:"Mein Fuß tut weh.",exEn:"My foot hurts.",diff:"easy"},{de:"das Bein",en:"leg",ex:"Mein Bein ist gebrochen.",exEn:"My leg is broken.",diff:"easy"},{de:"der Arm",en:"arm",ex:"Er hat einen starken Arm.",exEn:"He has a strong arm.",diff:"easy"},{de:"der Rücken",en:"back",ex:"Mein Rücken tut weh.",exEn:"My back hurts.",diff:"medium"},{de:"das Herz",en:"heart",ex:"Das Herz schlägt schnell.",exEn:"The heart is beating fast.",diff:"easy"},{de:"der Zahn",en:"tooth",ex:"Ich muss zum Zahnarzt.",exEn:"I have to go to the dentist.",diff:"medium",hint:"Zahn (tooth) + Arzt (doctor) = dentist"},{de:"die Haare",en:"hair",ex:"Sie hat lange Haare.",exEn:"She has long hair.",diff:"easy"},{de:"der Bauch",en:"stomach / belly",ex:"Ich habe Bauchschmerzen.",exEn:"I have a stomach ache.",diff:"medium"},{de:"krank",en:"sick / ill",ex:"Ich bin krank.",exEn:"I'm sick.",diff:"easy"},{de:"gesund",en:"healthy",ex:"Sport ist gesund.",exEn:"Sport is healthy.",diff:"easy"},{de:"der Arzt",en:"doctor",ex:"Ich muss zum Arzt gehen.",exEn:"I have to go to the doctor.",diff:"easy"},{de:"die Apotheke",en:"pharmacy",ex:"Die Apotheke ist um die Ecke.",exEn:"The pharmacy is around the corner.",diff:"medium"},{de:"das Krankenhaus",en:"hospital",ex:"Er liegt im Krankenhaus.",exEn:"He's in hospital.",diff:"hard",hint:"krank (sick) + Haus (house)"},{de:"die Schmerzen",en:"pain",ex:"Ich habe starke Schmerzen.",exEn:"I'm in a lot of pain.",diff:"medium"},{de:"müde",en:"tired",ex:"Ich bin sehr müde.",exEn:"I'm very tired.",diff:"easy"},{de:"das Fieber",en:"fever",ex:"Sie hat hohes Fieber.",exEn:"She has a high fever.",diff:"medium"},{de:"die Erkältung",en:"cold (illness)",ex:"Ich habe eine Erkältung.",exEn:"I have a cold.",diff:"hard",hint:"kalt (cold) → erkälten (to catch cold) → Erkältung"},{de:"sich fühlen",en:"to feel",ex:"Ich fühle mich besser.",exEn:"I feel better.",diff:"medium"},{de:"die Schulter",en:"shoulder",ex:"Meine Schulter ist verspannt.",exEn:"My shoulder is tense.",diff:"medium"},{de:"das Knie",en:"knee",ex:"Mein Knie tut weh beim Laufen.",exEn:"My knee hurts when I run.",diff:"easy"},{de:"der Hals",en:"neck / throat",ex:"Ich habe Halsschmerzen.",exEn:"I have a sore throat.",diff:"medium"},{de:"die Haut",en:"skin",ex:"Die Haut ist trocken.",exEn:"The skin is dry.",diff:"medium"},{de:"das Rezept",en:"prescription / recipe",ex:"Der Arzt hat mir ein Rezept gegeben.",exEn:"The doctor gave me a prescription.",diff:"medium"},{de:"der Bart",en:"beard",ex:"Mein Vater hat einen grauen Bart.",exEn:"My father has a grey beard.",diff:"easy"},{de:"die Brust",en:"chest",ex:"Mir tut die Brust weh.",exEn:"My chest hurts.",diff:"easy"},{de:"der Magen",en:"stomach",ex:"Mein Magen knurrt.",exEn:"My stomach is rumbling.",diff:"medium"},{de:"das Gehirn",en:"brain",ex:"Das Gehirn arbeitet sogar im Schlaf.",exEn:"The brain works even during sleep.",diff:"medium"},{de:"das Blut",en:"blood",ex:"Ich vertrage den Anblick von Blut nicht.",exEn:"I can't stand the sight of blood.",diff:"easy"},{de:"die Zunge",en:"tongue",ex:"Die Zunge schmeckt süß und salzig.",exEn:"The tongue tastes sweet and salty.",diff:"medium"},{de:"der Ellbogen",en:"elbow",ex:"Ich habe mir am Ellbogen gestoßen.",exEn:"I bumped my elbow.",diff:"medium"},{de:"das Handgelenk",en:"wrist",ex:"Mein Handgelenk tut weh.",exEn:"My wrist hurts.",diff:"medium",hint:"Hand + Gelenk (joint)"},{de:"die Pille",en:"pill",ex:"Nimm zwei Pillen am Tag.",exEn:"Take two pills a day.",diff:"easy"},{de:"die Spritze",en:"injection / syringe",ex:"Die Krankenschwester gibt mir eine Spritze.",exEn:"The nurse is giving me an injection.",diff:"medium"},{de:"die Operation",en:"operation",ex:"Die Operation war erfolgreich.",exEn:"The operation was successful.",diff:"medium"},{de:"sich verletzen",en:"to injure oneself",ex:"Ich habe mich beim Sport verletzt.",exEn:"I hurt myself doing sport.",diff:"hard"},{de:"husten",en:"to cough",ex:"Ich muss viel husten.",exEn:"I have to cough a lot.",diff:"medium"},{de:"niesen",en:"to sneeze",ex:"Ich musste dreimal niesen.",exEn:"I had to sneeze three times.",diff:"medium"},{de:"schwitzen",en:"to sweat",ex:"Beim Joggen schwitze ich viel.",exEn:"I sweat a lot when jogging.",diff:"medium"},
  ,
      {de:"die Grippe",en:"flu",ex:"Ich habe die Grippe.",exEn:"I have the flu.",diff:"medium"},
      {de:"der Verband",en:"bandage",ex:"Ich brauche einen Verband.",exEn:"I need a bandage.",diff:"medium"},
      {de:"der Notfall",en:"emergency",ex:"Im Notfall rufen Sie 112.",exEn:"In an emergency, call 112.",diff:"medium"},
      {de:"die Impfung",en:"vaccination",ex:"Hast du deine Impfung bekommen?",exEn:"Did you get your vaccination?",diff:"medium"},
      {de:"die Allergie",en:"allergy",ex:"Ich habe eine Allergie gegen Nüsse.",exEn:"I'm allergic to nuts.",diff:"medium"}
    ],
  "Colours & Descriptions": [
    {de:"rot",en:"red",ex:"Das Auto ist rot.",exEn:"The car is red.",diff:"easy"},{de:"blau",en:"blue",ex:"Der Himmel ist blau.",exEn:"The sky is blue.",diff:"easy"},{de:"grün",en:"green",ex:"Das Gras ist grün.",exEn:"The grass is green.",diff:"easy"},{de:"gelb",en:"yellow",ex:"Die Sonne ist gelb.",exEn:"The sun is yellow.",diff:"easy"},{de:"schwarz",en:"black",ex:"Ich trage ein schwarzes T-Shirt.",exEn:"I'm wearing a black T-shirt.",diff:"easy"},{de:"weiß",en:"white",ex:"Der Schnee ist weiß.",exEn:"The snow is white.",diff:"easy"},{de:"grau",en:"grey",ex:"Der Himmel ist grau heute.",exEn:"The sky is grey today.",diff:"easy"},{de:"braun",en:"brown",ex:"Der Hund ist braun.",exEn:"The dog is brown.",diff:"easy"},{de:"groß",en:"big / tall",ex:"Das Haus ist sehr groß.",exEn:"The house is very big.",diff:"easy"},{de:"klein",en:"small / short",ex:"Das Kind ist noch klein.",exEn:"The child is still small.",diff:"easy"},{de:"lang",en:"long",ex:"Der Weg ist lang.",exEn:"The path is long.",diff:"easy"},{de:"kurz",en:"short (length)",ex:"Die Hose ist zu kurz.",exEn:"The trousers are too short.",diff:"easy"},{de:"alt",en:"old",ex:"Das Gebäude ist sehr alt.",exEn:"The building is very old.",diff:"easy"},{de:"neu",en:"new",ex:"Ich habe ein neues Handy.",exEn:"I have a new phone.",diff:"easy"},{de:"schön",en:"beautiful / nice",ex:"Das Wetter ist schön heute.",exEn:"The weather is nice today.",diff:"easy"},{de:"hässlich",en:"ugly",ex:"Das Gebäude ist hässlich.",exEn:"The building is ugly.",diff:"medium"},{de:"schnell",en:"fast",ex:"Der Zug ist sehr schnell.",exEn:"The train is very fast.",diff:"easy"},{de:"langsam",en:"slow",ex:"Bitte fahren Sie langsamer.",exEn:"Please drive more slowly.",diff:"easy"},{de:"leicht",en:"easy / light",ex:"Die Aufgabe ist leicht.",exEn:"The task is easy.",diff:"easy"},{de:"schwer",en:"heavy / difficult",ex:"Der Koffer ist schwer.",exEn:"The suitcase is heavy.",diff:"easy"},{de:"teuer",en:"expensive",ex:"Das Hotel ist zu teuer.",exEn:"The hotel is too expensive.",diff:"easy"},{de:"billig",en:"cheap",ex:"Das Essen hier ist billig.",exEn:"The food here is cheap.",diff:"easy"},{de:"heiß",en:"hot",ex:"Der Kaffee ist heiß.",exEn:"The coffee is hot.",diff:"easy"},{de:"kalt",en:"cold",ex:"Mir ist kalt.",exEn:"I'm cold.",diff:"easy"},{de:"voll",en:"full",ex:"Der Bus ist voll.",exEn:"The bus is full.",diff:"easy"},{de:"leer",en:"empty",ex:"Die Flasche ist leer.",exEn:"The bottle is empty.",diff:"easy"},{de:"richtig",en:"right / correct",ex:"Die Antwort ist richtig.",exEn:"The answer is right.",diff:"easy"},{de:"falsch",en:"wrong / false",ex:"Das ist falsch.",exEn:"That is wrong.",diff:"easy"},{de:"wichtig",en:"important",ex:"Das ist sehr wichtig.",exEn:"That is very important.",diff:"easy"},{de:"einfach",en:"simple / easy",ex:"Das ist ganz einfach.",exEn:"That's quite easy.",diff:"easy"},{de:"rosa",en:"pink",ex:"Das Baby trägt rosa Kleidung.",exEn:"The baby is wearing pink clothes.",diff:"easy"},{de:"lila",en:"purple",ex:"Ihre Lieblingsfarbe ist lila.",exEn:"Her favourite colour is purple.",diff:"easy"},{de:"orange",en:"orange (colour)",ex:"Die Orange ist orange.",exEn:"The orange is orange.",diff:"easy"},{de:"golden",en:"golden",ex:"Die Uhr ist golden.",exEn:"The watch is golden.",diff:"medium"},{de:"silbern",en:"silver",ex:"Der Ring ist silbern.",exEn:"The ring is silver.",diff:"medium"},{de:"dunkel",en:"dark",ex:"Im Winter wird es früh dunkel.",exEn:"In winter it gets dark early.",diff:"easy"},{de:"hell",en:"bright / light",ex:"Das Zimmer ist sehr hell.",exEn:"The room is very bright.",diff:"easy"},{de:"rund",en:"round",ex:"Der Tisch ist rund.",exEn:"The table is round.",diff:"easy"},{de:"eckig",en:"angular / square",ex:"Das Fenster ist eckig.",exEn:"The window is rectangular.",diff:"medium"},{de:"weich",en:"soft",ex:"Das Bett ist weich.",exEn:"The bed is soft.",diff:"easy"},{de:"hart",en:"hard",ex:"Das Brot ist zu hart.",exEn:"The bread is too hard.",diff:"easy"},{de:"glatt",en:"smooth",ex:"Die Straße ist glatt, sei vorsichtig.",exEn:"The road is slippery, be careful.",diff:"medium"},{de:"rau",en:"rough",ex:"Die Oberfläche ist rau.",exEn:"The surface is rough.",diff:"medium"},{de:"eng",en:"narrow / tight",ex:"Die Hose ist zu eng.",exEn:"The trousers are too tight.",diff:"medium"},{de:"breit",en:"wide",ex:"Die Straße ist sehr breit.",exEn:"The street is very wide.",diff:"easy"},
  ,
      {de:"hübsch",en:"pretty",ex:"Sie hat ein hübsches Kleid.",exEn:"She has a pretty dress.",diff:"easy"},
      {de:"attraktiv",en:"attractive",ex:"Er findet sie sehr attraktiv.",exEn:"He finds her very attractive.",diff:"medium"},
      {de:"dünn",en:"thin",ex:"Das Buch ist sehr dünn.",exEn:"The book is very thin.",diff:"easy"},
      {de:"dick",en:"thick / fat",ex:"Die Wand ist sehr dick.",exEn:"The wall is very thick.",diff:"easy"},
      {de:"schmal",en:"narrow",ex:"Die Straße ist zu schmal.",exEn:"The street is too narrow.",diff:"medium"},
      {de:"leise",en:"quiet",ex:"Bitte sprich leise!",exEn:"Please speak quietly!",diff:"easy"},
      {de:"tief",en:"deep",ex:"Der See ist sehr tief.",exEn:"The lake is very deep.",diff:"easy"},
      {de:"flach",en:"flat / shallow",ex:"Das Land ist ganz flach.",exEn:"The country is totally flat.",diff:"medium"}
    ],
  "Common Verbs": [
    {de:"sein",en:"to be",ex:"Ich bin Student.",exEn:"I'm a student.",diff:"easy"},{de:"haben",en:"to have",ex:"Ich habe einen Hund.",exEn:"I have a dog.",diff:"easy"},{de:"machen",en:"to do / make",ex:"Was machst du heute?",exEn:"What are you doing today?",diff:"easy"},{de:"gehen",en:"to go (on foot)",ex:"Ich gehe zur Arbeit.",exEn:"I'm going to work.",diff:"easy"},{de:"kommen",en:"to come",ex:"Wann kommst du?",exEn:"When are you coming?",diff:"easy"},{de:"sehen",en:"to see",ex:"Ich sehe dich morgen.",exEn:"I'll see you tomorrow.",diff:"easy"},{de:"essen",en:"to eat",ex:"Wir essen um zwölf.",exEn:"We eat at twelve.",diff:"easy"},{de:"trinken",en:"to drink",ex:"Ich trinke Wasser.",exEn:"I drink water.",diff:"easy"},{de:"schlafen",en:"to sleep",ex:"Ich schlafe acht Stunden.",exEn:"I sleep eight hours.",diff:"easy"},{de:"sprechen",en:"to speak",ex:"Sprechen Sie Deutsch?",exEn:"Do you speak German?",diff:"medium"},{de:"lesen",en:"to read",ex:"Ich lese ein Buch.",exEn:"I'm reading a book.",diff:"easy"},{de:"schreiben",en:"to write",ex:"Ich schreibe eine E-Mail.",exEn:"I'm writing an email.",diff:"medium"},{de:"arbeiten",en:"to work",ex:"Ich arbeite in Newport.",exEn:"I work in Newport.",diff:"easy"},{de:"lernen",en:"to learn / study",ex:"Ich lerne Deutsch.",exEn:"I'm learning German.",diff:"easy"},{de:"wissen",en:"to know (a fact)",ex:"Ich weiß es nicht.",exEn:"I don't know.",diff:"medium",hint:"wissen = know a fact; kennen = know a person/place"},{de:"kennen",en:"to know (person/place)",ex:"Ich kenne Berlin gut.",exEn:"I know Berlin well.",diff:"medium"},{de:"wollen",en:"to want",ex:"Ich will nach Hause gehen.",exEn:"I want to go home.",diff:"medium"},{de:"können",en:"can / to be able to",ex:"Ich kann schwimmen.",exEn:"I can swim.",diff:"medium"},{de:"müssen",en:"must / to have to",ex:"Ich muss morgen arbeiten.",exEn:"I have to work tomorrow.",diff:"medium"},{de:"sollen",en:"should / supposed to",ex:"Was soll ich machen?",exEn:"What should I do?",diff:"medium"},{de:"dürfen",en:"may / to be allowed to",ex:"Darf ich hier rauchen?",exEn:"May I smoke here?",diff:"hard",hint:"dürfen = permission (may I?); können = ability (can I?)"},{de:"geben",en:"to give",ex:"Gib mir das Buch.",exEn:"Give me the book.",diff:"easy"},{de:"nehmen",en:"to take",ex:"Ich nehme den Bus.",exEn:"I'm taking the bus.",diff:"easy"},{de:"finden",en:"to find",ex:"Ich finde das gut.",exEn:"I think that's good.",diff:"easy"},{de:"denken",en:"to think",ex:"Ich denke, das ist richtig.",exEn:"I think that's right.",diff:"easy"},{de:"sagen",en:"to say",ex:"Was hast du gesagt?",exEn:"What did you say?",diff:"easy"},{de:"fragen",en:"to ask",ex:"Darf ich etwas fragen?",exEn:"May I ask something?",diff:"easy"},{de:"helfen",en:"to help",ex:"Kannst du mir helfen?",exEn:"Can you help me?",diff:"easy"},{de:"kaufen",en:"to buy",ex:"Ich kaufe Brot.",exEn:"I'm buying bread.",diff:"easy"},{de:"fahren",en:"to drive / travel",ex:"Ich fahre mit dem Zug.",exEn:"I'm going by train.",diff:"easy"},{de:"laufen",en:"to run / walk",ex:"Ich laufe jeden Morgen.",exEn:"I run every morning.",diff:"easy"},{de:"stehen",en:"to stand",ex:"Er steht an der Haltestelle.",exEn:"He's standing at the stop.",diff:"easy"},{de:"sitzen",en:"to sit",ex:"Ich sitze am Fenster.",exEn:"I'm sitting at the window.",diff:"easy"},{de:"liegen",en:"to lie (position)",ex:"Das Buch liegt auf dem Tisch.",exEn:"The book is on the table.",diff:"easy"},{de:"wohnen",en:"to live (reside)",ex:"Ich wohne in Newport.",exEn:"I live in Newport.",diff:"easy"},{de:"brauchen",en:"to need",ex:"Ich brauche Hilfe.",exEn:"I need help.",diff:"easy"},{de:"bringen",en:"to bring",ex:"Bring bitte Milch mit.",exEn:"Please bring milk.",diff:"easy"},{de:"beginnen",en:"to begin",ex:"Der Film beginnt um acht.",exEn:"The film starts at eight.",diff:"medium"},{de:"verstehen",en:"to understand",ex:"Ich verstehe das nicht.",exEn:"I don't understand that.",diff:"medium",hint:"ver- prefix often = completing/finishing"},{de:"versuchen",en:"to try",ex:"Ich versuche mein Bestes.",exEn:"I try my best.",diff:"medium"},{de:"öffnen",en:"to open",ex:"Öffne bitte die Tür.",exEn:"Please open the door.",diff:"easy"},{de:"schließen",en:"to close",ex:"Schließ bitte das Fenster.",exEn:"Please close the window.",diff:"medium"},{de:"spielen",en:"to play",ex:"Die Kinder spielen draußen.",exEn:"The children are playing outside.",diff:"easy"},{de:"hören",en:"to hear / listen",ex:"Ich höre Musik.",exEn:"I'm listening to music.",diff:"easy"},{de:"warten",en:"to wait",ex:"Warte auf mich!",exEn:"Wait for me!",diff:"easy"},{de:"mitnehmen",en:"to take along",ex:"Ich nehme einen Regenschirm mit.",exEn:"I'm taking an umbrella with me.",diff:"medium",hint:"Separable: ich nehme … mit"},{de:"abholen",en:"to pick up",ex:"Ich hole dich vom Bahnhof ab.",exEn:"I'll pick you up from the station.",diff:"medium"},{de:"aussteigen",en:"to get off",ex:"An welcher Haltestelle steige ich aus?",exEn:"At which stop do I get off?",diff:"medium"},{de:"einsteigen",en:"to get on",ex:"Bitte einsteigen!",exEn:"Please board!",diff:"medium"},{de:"aufmachen",en:"to open (informal)",ex:"Mach das Fenster auf!",exEn:"Open the window!",diff:"easy"},{de:"zumachen",en:"to close (informal)",ex:"Mach bitte die Tür zu.",exEn:"Please close the door.",diff:"easy"},{de:"zuhören",en:"to listen",ex:"Hör mir bitte zu!",exEn:"Please listen to me!",diff:"medium"},{de:"erzählen",en:"to tell",ex:"Erzähl mir eine Geschichte.",exEn:"Tell me a story.",diff:"medium"},{de:"antworten",en:"to answer",ex:"Sie antwortet nicht auf meine E-Mail.",exEn:"She's not answering my email.",diff:"easy"},{de:"bedeuten",en:"to mean",ex:"Was bedeutet dieses Wort?",exEn:"What does this word mean?",diff:"medium"},{de:"passieren",en:"to happen",ex:"Was ist hier passiert?",exEn:"What happened here?",diff:"medium"},{de:"bleiben",en:"to stay / remain",ex:"Ich bleibe heute zu Hause.",exEn:"I'm staying home today.",diff:"easy"},{de:"vergleichen",en:"to compare",ex:"Vergleich die beiden Preise.",exEn:"Compare the two prices.",diff:"hard"},{de:"entscheiden",en:"to decide",ex:"Ich kann mich nicht entscheiden.",exEn:"I can't decide.",diff:"hard"},{de:"wählen",en:"to choose",ex:"Wähl eine Farbe.",exEn:"Choose a colour.",diff:"easy"},{de:"verlieren",en:"to lose",ex:"Ich habe meinen Schlüssel verloren.",exEn:"I've lost my key.",diff:"medium"},{de:"gewinnen",en:"to win",ex:"Unser Team hat gewonnen!",exEn:"Our team won!",diff:"medium"},{de:"treffen",en:"to meet",ex:"Ich treffe sie im Park.",exEn:"I'm meeting her in the park.",diff:"easy"},{de:"einladen",en:"to invite",ex:"Ich lade dich zum Essen ein.",exEn:"I'm inviting you for dinner.",diff:"medium"},{de:"feiern",en:"to celebrate",ex:"Wir feiern meinen Geburtstag.",exEn:"We're celebrating my birthday.",diff:"easy"},{de:"schmecken",en:"to taste",ex:"Das schmeckt gut!",exEn:"That tastes good!",diff:"medium"},{de:"riechen",en:"to smell",ex:"Die Blumen riechen wunderbar.",exEn:"The flowers smell wonderful.",diff:"medium"},{de:"aussehen",en:"to look / appear",ex:"Du siehst müde aus.",exEn:"You look tired.",diff:"medium"},
  ],
  "Weather & Nature": [
    {de:"das Wetter",en:"weather",ex:"Wie ist das Wetter heute?",exEn:"How's the weather today?",diff:"easy"},{de:"die Sonne",en:"sun",ex:"Die Sonne scheint.",exEn:"The sun is shining.",diff:"easy"},{de:"der Regen",en:"rain",ex:"Es gibt viel Regen in Wales.",exEn:"There's a lot of rain in Wales.",diff:"easy"},{de:"der Schnee",en:"snow",ex:"Im Winter gibt es Schnee.",exEn:"In winter there's snow.",diff:"easy"},{de:"der Wind",en:"wind",ex:"Heute ist es windig.",exEn:"It's windy today.",diff:"easy"},{de:"die Wolke",en:"cloud",ex:"Es gibt viele Wolken am Himmel.",exEn:"There are many clouds in the sky.",diff:"easy"},{de:"der Himmel",en:"sky / heaven",ex:"Der Himmel ist klar.",exEn:"The sky is clear.",diff:"easy"},{de:"warm",en:"warm",ex:"Heute ist es warm.",exEn:"It's warm today.",diff:"easy"},{de:"der Baum",en:"tree",ex:"Der Baum ist sehr alt.",exEn:"The tree is very old.",diff:"easy"},{de:"die Blume",en:"flower",ex:"Die Blumen sind schön.",exEn:"The flowers are beautiful.",diff:"easy"},{de:"der Berg",en:"mountain",ex:"Wir wandern auf den Berg.",exEn:"We're hiking up the mountain.",diff:"easy"},{de:"der Fluss",en:"river",ex:"Der Fluss ist lang.",exEn:"The river is long.",diff:"easy"},{de:"das Meer",en:"sea",ex:"Wir fahren ans Meer.",exEn:"We're going to the sea.",diff:"easy"},{de:"der See",en:"lake",ex:"Der See ist ruhig.",exEn:"The lake is calm.",diff:"easy",hint:"der See = lake; die See = sea"},{de:"der Wald",en:"forest",ex:"Wir gehen in den Wald.",exEn:"We're going to the forest.",diff:"easy"},{de:"das Tier",en:"animal",ex:"Welches Tier magst du?",exEn:"Which animal do you like?",diff:"easy"},{de:"der Hund",en:"dog",ex:"Mein Hund heißt Max.",exEn:"My dog is called Max.",diff:"easy"},{de:"die Katze",en:"cat",ex:"Die Katze schläft.",exEn:"The cat is sleeping.",diff:"easy"},{de:"der Vogel",en:"bird",ex:"Der Vogel singt.",exEn:"The bird is singing.",diff:"easy"},{de:"die Luft",en:"air",ex:"Die Luft ist frisch.",exEn:"The air is fresh.",diff:"easy"},{de:"der Stein",en:"stone / rock",ex:"Der Stein ist schwer.",exEn:"The stone is heavy.",diff:"easy"},{de:"die Erde",en:"earth / soil",ex:"Die Erde ist nass.",exEn:"The ground is wet.",diff:"easy"},{de:"das Feuer",en:"fire",ex:"Das Feuer ist heiß.",exEn:"The fire is hot.",diff:"easy"},{de:"der Strand",en:"beach",ex:"Wir gehen zum Strand.",exEn:"We're going to the beach.",diff:"easy"},{de:"die Landschaft",en:"landscape",ex:"Die Landschaft ist wunderschön.",exEn:"The landscape is beautiful.",diff:"medium"},{de:"der Nebel",en:"fog",ex:"Am Morgen gibt es oft Nebel.",exEn:"There's often fog in the morning.",diff:"medium"},{de:"das Gewitter",en:"thunderstorm",ex:"Heute Nacht kommt ein Gewitter.",exEn:"A thunderstorm is coming tonight.",diff:"hard",hint:"Ge- prefix + Wetter = intense weather event"},{de:"der Regenbogen",en:"rainbow",ex:"Schau mal, ein Regenbogen!",exEn:"Look, a rainbow!",diff:"medium",hint:"Regen (rain) + Bogen (bow/arc)"},{de:"die Wiese",en:"meadow",ex:"Die Kühe stehen auf der Wiese.",exEn:"The cows are standing in the meadow.",diff:"medium"},{de:"das Tal",en:"valley",ex:"Das Dorf liegt im Tal.",exEn:"The village lies in the valley.",diff:"medium"},{de:"sonnig",en:"sunny",ex:"Heute ist es sonnig.",exEn:"It's sunny today.",diff:"easy"},{de:"wolkig",en:"cloudy",ex:"Der Himmel ist wolkig.",exEn:"The sky is cloudy.",diff:"easy"},{de:"regnerisch",en:"rainy",ex:"Das Wetter ist regnerisch.",exEn:"The weather is rainy.",diff:"medium"},{de:"windig",en:"windy",ex:"Heute ist es sehr windig.",exEn:"It's very windy today.",diff:"easy"},{de:"neblig",en:"foggy",ex:"Am Morgen ist es oft neblig.",exEn:"It's often foggy in the morning.",diff:"medium"},{de:"der Sturm",en:"storm",ex:"Der Sturm hat den Baum umgeweht.",exEn:"The storm knocked down the tree.",diff:"easy"},{de:"die Jahreszeit",en:"season",ex:"Welche Jahreszeit magst du am liebsten?",exEn:"Which season do you like best?",diff:"medium"},{de:"der Frühling",en:"spring",ex:"Im Frühling blühen die Blumen.",exEn:"Flowers bloom in spring.",diff:"easy"},{de:"der Sommer",en:"summer",ex:"Im Sommer fahren wir ans Meer.",exEn:"In summer we go to the sea.",diff:"easy"},{de:"der Herbst",en:"autumn",ex:"Im Herbst fallen die Blätter.",exEn:"Leaves fall in autumn.",diff:"easy"},{de:"der Winter",en:"winter",ex:"Der Winter ist kalt und dunkel.",exEn:"Winter is cold and dark.",diff:"easy"},{de:"die Insel",en:"island",ex:"Sylt ist eine deutsche Insel.",exEn:"Sylt is a German island.",diff:"easy"},{de:"der Park",en:"park",ex:"Wir gehen im Park spazieren.",exEn:"We go for a walk in the park.",diff:"easy"},{de:"die Pflanze",en:"plant",ex:"Meine Pflanze braucht Wasser.",exEn:"My plant needs water.",diff:"easy"},{de:"das Blatt",en:"leaf / sheet",ex:"Das Blatt ist grün.",exEn:"The leaf is green.",diff:"easy"},
  ,
      {de:"die Temperatur",en:"temperature",ex:"Die Temperatur fällt schnell.",exEn:"The temperature is falling fast.",diff:"easy"},
      {de:"frieren",en:"to freeze / be cold",ex:"Ich friere, mach die Tür zu.",exEn:"I'm freezing, close the door.",diff:"medium"},
      {de:"schmelzen",en:"to melt",ex:"Der Schnee schmilzt.",exEn:"The snow is melting.",diff:"medium"},
      {de:"der Donner",en:"thunder",ex:"Hörst du den Donner?",exEn:"Can you hear the thunder?",diff:"medium"},
      {de:"der Blitz",en:"lightning",ex:"Der Blitz hat den Baum getroffen.",exEn:"Lightning struck the tree.",diff:"medium"}
    ],
  "Travel & Directions": [
    {de:"links",en:"left",ex:"Gehen Sie nach links.",exEn:"Go left.",diff:"easy"},{de:"rechts",en:"right",ex:"Das Hotel ist rechts.",exEn:"The hotel is on the right.",diff:"easy"},{de:"geradeaus",en:"straight ahead",ex:"Gehen Sie geradeaus.",exEn:"Go straight ahead.",diff:"medium",hint:"gerade (straight) + aus (out)"},{de:"die Straße",en:"street / road",ex:"Die Straße ist lang.",exEn:"The street is long.",diff:"easy"},{de:"der Bahnhof",en:"train station",ex:"Wo ist der Bahnhof?",exEn:"Where is the station?",diff:"medium",hint:"Bahn (train/track) + Hof (yard/court)"},{de:"der Flughafen",en:"airport",ex:"Der Flughafen ist weit.",exEn:"The airport is far.",diff:"hard",hint:"Flug (flight) + Hafen (harbour)"},{de:"die Haltestelle",en:"bus/tram stop",ex:"Die Haltestelle ist da drüben.",exEn:"The stop is over there.",diff:"hard",hint:"halten (to stop) + Stelle (place)"},{de:"der Zug",en:"train",ex:"Der Zug fährt um neun ab.",exEn:"The train leaves at nine.",diff:"easy"},{de:"der Bus",en:"bus",ex:"Ich nehme den Bus.",exEn:"I'm taking the bus.",diff:"easy"},{de:"das Auto",en:"car",ex:"Ich fahre mit dem Auto.",exEn:"I'm going by car.",diff:"easy"},{de:"das Fahrrad",en:"bicycle",ex:"Ich fahre gern Fahrrad.",exEn:"I like riding a bike.",diff:"medium",hint:"fahren (ride) + Rad (wheel)"},{de:"das Flugzeug",en:"aeroplane",ex:"Das Flugzeug landet um zehn.",exEn:"The plane lands at ten.",diff:"hard",hint:"Flug (flight) + Zeug (thing/craft)"},{de:"die Fahrkarte",en:"ticket (transport)",ex:"Ich brauche eine Fahrkarte.",exEn:"I need a ticket.",diff:"hard",hint:"fahren (travel) + Karte (card)"},{de:"die Karte",en:"map / card",ex:"Hast du eine Karte?",exEn:"Do you have a map?",diff:"easy"},{de:"das Hotel",en:"hotel",ex:"Das Hotel ist in der Stadtmitte.",exEn:"The hotel is in the city centre.",diff:"easy"},{de:"die Unterkunft",en:"accommodation",ex:"Hast du eine Unterkunft?",exEn:"Do you have a place to stay?",diff:"hard",hint:"unter (under) + Kunft (coming) = place to come under"},{de:"der Koffer",en:"suitcase",ex:"Mein Koffer ist schwer.",exEn:"My suitcase is heavy.",diff:"easy"},{de:"die Reise",en:"trip / journey",ex:"Die Reise war toll.",exEn:"The trip was great.",diff:"easy"},{de:"der Ausgang",en:"exit",ex:"Wo ist der Ausgang?",exEn:"Where is the exit?",diff:"medium",hint:"aus (out) + Gang (going)"},{de:"der Eingang",en:"entrance",ex:"Der Eingang ist dort.",exEn:"The entrance is there.",diff:"medium",hint:"ein (in) + Gang (going)"},{de:"weit",en:"far",ex:"Ist es weit von hier?",exEn:"Is it far from here?",diff:"easy"},{de:"nah / in der Nähe",en:"near / nearby",ex:"Der Supermarkt ist in der Nähe.",exEn:"The supermarket is nearby.",diff:"easy"},{de:"die Brücke",en:"bridge",ex:"Geh über die Brücke.",exEn:"Go over the bridge.",diff:"medium"},{de:"die Ecke",en:"corner",ex:"Um die Ecke ist ein Café.",exEn:"Around the corner is a café.",diff:"easy"},{de:"ankommen",en:"to arrive",ex:"Wann kommen wir an?",exEn:"When do we arrive?",diff:"medium",hint:"an- (at/on) + kommen (come) — separable"},{de:"abfahren",en:"to depart",ex:"Der Zug fährt um zehn ab.",exEn:"The train leaves at ten.",diff:"medium"},{de:"umsteigen",en:"to change (trains)",ex:"Du musst in Köln umsteigen.",exEn:"You have to change in Cologne.",diff:"hard",hint:"um- (around) + steigen (climb) — separable"},{de:"die Sehenswürdigkeit",en:"sight / attraction",ex:"Berlin hat viele Sehenswürdigkeiten.",exEn:"Berlin has many attractions.",diff:"hard",hint:"sehen (see) + würdig (worthy) + -keit (noun)"},{de:"sich verirren",en:"to get lost",ex:"Wir haben uns verirrt.",exEn:"We got lost.",diff:"hard"},{de:"empfehlen",en:"to recommend",ex:"Können Sie etwas empfehlen?",exEn:"Can you recommend something?",diff:"hard"},{de:"die Fahrt",en:"journey / ride",ex:"Gute Fahrt!",exEn:"Safe travels!",diff:"easy"},{de:"der Flug",en:"flight",ex:"Unser Flug hat Verspätung.",exEn:"Our flight is delayed.",diff:"easy"},{de:"die Verspätung",en:"delay",ex:"Der Zug hat zehn Minuten Verspätung.",exEn:"The train is ten minutes late.",diff:"hard"},{de:"der Führerschein",en:"driving licence",ex:"Ich habe meinen Führerschein mit 18 gemacht.",exEn:"I got my driving licence at 18.",diff:"hard"},{de:"tanken",en:"to refuel",ex:"Ich muss noch tanken.",exEn:"I still need to fill up.",diff:"medium"},{de:"die Tankstelle",en:"petrol station",ex:"Die Tankstelle ist gleich hier.",exEn:"The petrol station is right here.",diff:"medium"},{de:"das Taxi",en:"taxi",ex:"Ruf ein Taxi, bitte.",exEn:"Call a taxi, please.",diff:"easy"},{de:"die U-Bahn",en:"underground",ex:"Ich nehme die U-Bahn zur Arbeit.",exEn:"I take the underground to work.",diff:"easy"},{de:"die Straßenbahn",en:"tram",ex:"Die Straßenbahn kommt alle zehn Minuten.",exEn:"The tram comes every ten minutes.",diff:"medium"},{de:"das Schiff",en:"ship",ex:"Das Schiff fährt nach England.",exEn:"The ship goes to England.",diff:"easy"},{de:"die Grenze",en:"border",ex:"An der Grenze zeigen wir den Pass.",exEn:"We show our passport at the border.",diff:"medium"},{de:"der Pass",en:"passport",ex:"Vergiss deinen Pass nicht!",exEn:"Don't forget your passport!",diff:"easy"},{de:"der Ausweis",en:"ID card",ex:"Zeigen Sie mir bitte Ihren Ausweis.",exEn:"Please show me your ID.",diff:"medium"},{de:"buchen",en:"to book",ex:"Ich buche ein Hotel online.",exEn:"I'm booking a hotel online.",diff:"easy"},{de:"stornieren",en:"to cancel",ex:"Ich muss meinen Flug stornieren.",exEn:"I have to cancel my flight.",diff:"hard"},{de:"reservieren",en:"to reserve",ex:"Ich möchte einen Tisch reservieren.",exEn:"I'd like to reserve a table.",diff:"medium"},{de:"das Museum",en:"museum",ex:"Das Museum ist heute geschlossen.",exEn:"The museum is closed today.",diff:"easy"},{de:"die Kirche",en:"church",ex:"Die Kirche ist über 500 Jahre alt.",exEn:"The church is over 500 years old.",diff:"easy"},{de:"die Burg",en:"castle / fortress",ex:"Wir besuchen eine alte Burg.",exEn:"We're visiting an old castle.",diff:"medium"},{de:"der Urlaub",en:"holiday / vacation",ex:"Ich mache drei Wochen Urlaub.",exEn:"I'm taking three weeks of holiday.",diff:"easy"},
  ,
      {de:"der Stau",en:"traffic jam",ex:"Wir stehen im Stau.",exEn:"We're stuck in traffic.",diff:"medium"},
      {de:"die Autobahn",en:"motorway",ex:"Auf der Autobahn gibt es kein Tempolimit.",exEn:"There's no speed limit on the motorway.",diff:"medium"},
      {de:"die Panne",en:"breakdown",ex:"Wir hatten eine Panne auf dem Weg.",exEn:"We had a breakdown on the way.",diff:"hard"},
      {de:"das Gepäck",en:"luggage",ex:"Mein Gepäck ist verloren gegangen.",exEn:"My luggage got lost.",diff:"medium",hint:"mass noun — no plural"},
      {de:"der Reiseführer",en:"travel guide",ex:"Der Reiseführer hat uns viel erzählt.",exEn:"The guide told us a lot.",diff:"medium"}
    ],
  "Shopping & Money": [
    {de:"das Geld",en:"money",ex:"Ich habe kein Geld dabei.",exEn:"I don't have any money on me.",diff:"easy"},{de:"der Euro",en:"euro",ex:"Das kostet fünf Euro.",exEn:"That costs five euros.",diff:"easy"},{de:"der Preis",en:"price",ex:"Was ist der Preis?",exEn:"What's the price?",diff:"easy"},{de:"das Geschäft",en:"shop / store",ex:"Das Geschäft schließt um sechs.",exEn:"The shop closes at six.",diff:"medium"},{de:"der Supermarkt",en:"supermarket",ex:"Ich gehe zum Supermarkt.",exEn:"I'm going to the supermarket.",diff:"easy"},{de:"die Tasche",en:"bag / pocket",ex:"Ich brauche eine Tasche.",exEn:"I need a bag.",diff:"easy"},{de:"bezahlen",en:"to pay",ex:"Wo kann ich bezahlen?",exEn:"Where can I pay?",diff:"medium"},{de:"kosten",en:"to cost",ex:"Was kostet das?",exEn:"How much does that cost?",diff:"easy"},{de:"die Kasse",en:"checkout / till",ex:"Bitte gehen Sie zur Kasse.",exEn:"Please go to the till.",diff:"medium"},{de:"der Markt",en:"market",ex:"Samstags gehe ich auf den Markt.",exEn:"On Saturdays I go to the market.",diff:"easy"},{de:"das Angebot",en:"offer / deal",ex:"Das ist ein gutes Angebot.",exEn:"That's a good offer.",diff:"medium"},{de:"die Größe",en:"size",ex:"Welche Größe brauchen Sie?",exEn:"What size do you need?",diff:"medium"},{de:"die Ermäßigung",en:"discount",ex:"Gibt es eine Ermäßigung?",exEn:"Is there a discount?",diff:"hard",hint:"mäßig (moderate) → er-mäßigen (to moderate/reduce)"},{de:"die Kleidung",en:"clothing",ex:"Ich kaufe neue Kleidung.",exEn:"I'm buying new clothes.",diff:"medium"},{de:"das Hemd",en:"shirt",ex:"Das Hemd ist zu klein.",exEn:"The shirt is too small.",diff:"easy"},{de:"die Hose",en:"trousers",ex:"Ich brauche eine neue Hose.",exEn:"I need new trousers.",diff:"easy"},{de:"die Schuhe",en:"shoes",ex:"Die Schuhe sind bequem.",exEn:"The shoes are comfortable.",diff:"easy"},{de:"die Jacke",en:"jacket",ex:"Nimm deine Jacke mit.",exEn:"Take your jacket with you.",diff:"easy"},{de:"umtauschen",en:"to exchange / return",ex:"Kann ich das umtauschen?",exEn:"Can I exchange this?",diff:"hard"},{de:"die Quittung",en:"receipt",ex:"Haben Sie die Quittung?",exEn:"Do you have the receipt?",diff:"hard"},{de:"günstig",en:"affordable / good value",ex:"Das Restaurant ist günstig.",exEn:"The restaurant is reasonable.",diff:"medium"},{de:"das Bargeld",en:"cash",ex:"Ich zahle mit Bargeld.",exEn:"I'm paying with cash.",diff:"medium",hint:"bar (cash/bare) + Geld (money)"},{de:"die Kreditkarte",en:"credit card",ex:"Nehmen Sie Kreditkarte?",exEn:"Do you take credit card?",diff:"easy"},{de:"der Einkauf",en:"shopping / purchase",ex:"Ich mache den Einkauf.",exEn:"I'm doing the shopping.",diff:"medium"},{de:"der Laden",en:"shop / store",ex:"Der Laden öffnet um neun.",exEn:"The shop opens at nine.",diff:"easy"},{de:"das Trinkgeld",en:"tip (money)",ex:"Soll ich Trinkgeld geben?",exEn:"Should I tip?",diff:"medium",hint:"trinken (drink) + Geld (money)"},{de:"der Gutschein",en:"voucher / coupon",ex:"Ich habe einen Gutschein.",exEn:"I have a voucher.",diff:"hard"},{de:"die Tüte",en:"carrier bag",ex:"Brauchen Sie eine Tüte?",exEn:"Do you need a bag?",diff:"medium"},{de:"die Marke",en:"brand",ex:"Welche Marke ist das?",exEn:"What brand is that?",diff:"easy"},{de:"der Rabatt",en:"rebate / discount",ex:"Es gibt zehn Prozent Rabatt.",exEn:"There's ten percent off.",diff:"medium"},{de:"die Bank",en:"bank",ex:"Die Bank ist bis 17 Uhr geöffnet.",exEn:"The bank is open until 5pm.",diff:"easy"},{de:"das Konto",en:"account",ex:"Ich möchte ein Konto eröffnen.",exEn:"I'd like to open an account.",diff:"easy"},{de:"die Überweisung",en:"transfer",ex:"Die Überweisung dauert zwei Tage.",exEn:"The transfer takes two days.",diff:"hard"},{de:"abheben",en:"to withdraw (money)",ex:"Ich hebe Geld am Automaten ab.",exEn:"I withdraw money at the ATM.",diff:"medium"},{de:"einzahlen",en:"to deposit",ex:"Ich zahle das Geld auf mein Konto ein.",exEn:"I deposit the money into my account.",diff:"medium"},{de:"der Automat",en:"ATM / vending machine",ex:"Wo ist der nächste Automat?",exEn:"Where is the nearest ATM?",diff:"medium"},{de:"bestellen",en:"to order",ex:"Ich bestelle online.",exEn:"I order online.",diff:"easy"},{de:"liefern",en:"to deliver",ex:"Wir liefern kostenlos.",exEn:"We deliver free of charge.",diff:"easy"},{de:"die Lieferung",en:"delivery",ex:"Die Lieferung kommt morgen.",exEn:"The delivery comes tomorrow.",diff:"medium"},{de:"versenden",en:"to ship",ex:"Wir versenden weltweit.",exEn:"We ship worldwide.",diff:"medium"},{de:"kostenlos",en:"free of charge",ex:"Der Eintritt ist kostenlos.",exEn:"Admission is free.",diff:"medium",hint:"kosten (cost) + los (without)"},{de:"das Sonderangebot",en:"special offer",ex:"Das Brot ist im Sonderangebot.",exEn:"The bread is on special offer.",diff:"hard"},{de:"die Auswahl",en:"selection",ex:"Wir haben eine große Auswahl.",exEn:"We have a wide selection.",diff:"medium"},{de:"die Qualität",en:"quality",ex:"Die Qualität ist ausgezeichnet.",exEn:"The quality is excellent.",diff:"easy"},{de:"das Paket",en:"parcel / package",ex:"Ein Paket ist für dich angekommen.",exEn:"A parcel has arrived for you.",diff:"easy"},
  ,
      {de:"die Mehrwertsteuer",en:"VAT / sales tax",ex:"Die Mehrwertsteuer ist schon im Preis.",exEn:"VAT is already in the price.",diff:"hard",hint:"often 'MwSt.'"},
      {de:"der Kassenbon",en:"receipt",ex:"Soll ich den Kassenbon mitnehmen?",exEn:"Should I take the receipt?",diff:"medium"},
      {de:"die Überraschung",en:"surprise",ex:"Was für eine schöne Überraschung!",exEn:"What a nice surprise!",diff:"medium"},
      {de:"die Umkleidekabine",en:"changing room",ex:"Wo ist die Umkleidekabine?",exEn:"Where is the changing room?",diff:"hard"},
      {de:"kontaktlos",en:"contactless",ex:"Ich zahle kontaktlos.",exEn:"I'm paying contactless.",diff:"medium"}
    ],
  "Emotions & Opinions": [
    {de:"glücklich",en:"happy",ex:"Ich bin glücklich.",exEn:"I'm happy.",diff:"easy"},{de:"traurig",en:"sad",ex:"Warum bist du traurig?",exEn:"Why are you sad?",diff:"easy"},{de:"wütend",en:"angry",ex:"Er ist wütend auf mich.",exEn:"He's angry with me.",diff:"medium"},{de:"Angst haben",en:"to be afraid",ex:"Ich habe Angst vor Spinnen.",exEn:"I'm afraid of spiders.",diff:"medium",hint:"Literally: to have fear"},{de:"sich freuen",en:"to be happy / look forward to",ex:"Ich freue mich auf das Wochenende.",exEn:"I look forward to the weekend.",diff:"hard",hint:"sich freuen auf = future; sich freuen über = now"},{de:"lieben",en:"to love",ex:"Ich liebe Musik.",exEn:"I love music.",diff:"easy"},{de:"hassen",en:"to hate",ex:"Ich hasse Stau.",exEn:"I hate traffic jams.",diff:"easy"},{de:"mögen",en:"to like",ex:"Ich mag Schokolade.",exEn:"I like chocolate.",diff:"easy"},{de:"hoffen",en:"to hope",ex:"Ich hoffe, es klappt.",exEn:"I hope it works out.",diff:"easy"},{de:"glauben",en:"to believe / think",ex:"Ich glaube, das ist richtig.",exEn:"I believe that's right.",diff:"easy"},{de:"Spaß machen",en:"to be fun",ex:"Das macht Spaß!",exEn:"That's fun!",diff:"medium"},{de:"langweilig",en:"boring",ex:"Der Film war langweilig.",exEn:"The film was boring.",diff:"medium"},{de:"interessant",en:"interesting",ex:"Das Buch ist sehr interessant.",exEn:"The book is very interesting.",diff:"easy"},{de:"toll",en:"great / awesome",ex:"Das war toll!",exEn:"That was great!",diff:"easy"},{de:"schlecht",en:"bad",ex:"Das Wetter ist schlecht.",exEn:"The weather is bad.",diff:"easy"},{de:"besser",en:"better",ex:"Heute geht es mir besser.",exEn:"I feel better today.",diff:"easy"},{de:"schlimm",en:"bad / terrible",ex:"Das ist nicht so schlimm.",exEn:"That's not so bad.",diff:"medium"},{de:"zufrieden",en:"satisfied / content",ex:"Ich bin zufrieden.",exEn:"I'm satisfied.",diff:"hard",hint:"zu (to) + Frieden (peace)"},{de:"überrascht",en:"surprised",ex:"Ich war total überrascht.",exEn:"I was totally surprised.",diff:"hard"},{de:"aufgeregt",en:"excited / nervous",ex:"Ich bin so aufgeregt!",exEn:"I'm so excited!",diff:"hard"},{de:"die Meinung",en:"opinion",ex:"Was ist deine Meinung?",exEn:"What's your opinion?",diff:"medium"},{de:"stimmen",en:"to be correct / agree",ex:"Das stimmt.",exEn:"That's right.",diff:"medium"},{de:"sich ärgern",en:"to be annoyed",ex:"Ich ärgere mich darüber.",exEn:"I'm annoyed about it.",diff:"hard"},{de:"sich Sorgen machen",en:"to worry",ex:"Mach dir keine Sorgen.",exEn:"Don't worry.",diff:"hard",hint:"Sorgen = worries; sich Sorgen machen = to make worries for oneself"},{de:"stolz",en:"proud",ex:"Ich bin stolz auf dich.",exEn:"I'm proud of you.",diff:"medium"},{de:"neugierig",en:"curious",ex:"Ich bin neugierig.",exEn:"I'm curious.",diff:"hard",hint:"neu (new) + gierig (greedy) = greedy for new things"},{de:"dankbar",en:"grateful",ex:"Ich bin dir sehr dankbar.",exEn:"I'm very thankful to you.",diff:"medium"},{de:"enttäuscht",en:"disappointed",ex:"Ich bin enttäuscht.",exEn:"I'm disappointed.",diff:"hard"},{de:"eifersüchtig",en:"jealous",ex:"Sei nicht eifersüchtig!",exEn:"Don't be jealous!",diff:"hard",hint:"Eifer (zeal) + Sucht (addiction)"},{de:"erleichtert",en:"relieved",ex:"Ich bin erleichtert.",exEn:"I'm relieved.",diff:"hard",hint:"er- + leicht (light/easy) = made lighter"},{de:"froh",en:"glad",ex:"Ich bin froh, dich zu sehen.",exEn:"I'm happy to see you.",diff:"easy"},{de:"nervös",en:"nervous",ex:"Ich bin vor der Prüfung nervös.",exEn:"I'm nervous before the exam.",diff:"easy"},{de:"ruhig",en:"calm",ex:"Bleib ruhig, alles wird gut.",exEn:"Stay calm, everything will be fine.",diff:"easy"},{de:"gelangweilt",en:"bored",ex:"Der Film war langweilig, ich war gelangweilt.",exEn:"The film was boring, I was bored.",diff:"medium"},{de:"schockiert",en:"shocked",ex:"Ich war total schockiert.",exEn:"I was totally shocked.",diff:"medium"},{de:"peinlich",en:"embarrassing",ex:"Das war mir so peinlich!",exEn:"That was so embarrassing!",diff:"medium"},{de:"einsam",en:"lonely",ex:"Ich fühle mich manchmal einsam.",exEn:"I sometimes feel lonely.",diff:"medium"},{de:"verwirrt",en:"confused",ex:"Ich bin völlig verwirrt.",exEn:"I'm totally confused.",diff:"medium"},{de:"entspannt",en:"relaxed",ex:"Nach dem Urlaub bin ich entspannt.",exEn:"After the holiday I feel relaxed.",diff:"easy"},{de:"beeindruckt",en:"impressed",ex:"Ich bin beeindruckt von deiner Arbeit.",exEn:"I'm impressed by your work.",diff:"hard"},{de:"begeistert",en:"enthusiastic",ex:"Die Kinder sind begeistert vom Zoo.",exEn:"The children are thrilled by the zoo.",diff:"hard"},{de:"die Angst",en:"fear",ex:"Ich habe Angst vor Spinnen.",exEn:"I'm afraid of spiders.",diff:"easy"},{de:"die Hoffnung",en:"hope",ex:"Es gibt noch Hoffnung.",exEn:"There's still hope.",diff:"easy"},{de:"der Stress",en:"stress",ex:"Ich habe zu viel Stress bei der Arbeit.",exEn:"I have too much stress at work.",diff:"easy"},{de:"lustig",en:"funny",ex:"Der Film war sehr lustig.",exEn:"The film was very funny.",diff:"easy"},
  ,
      {de:"meiner Meinung nach",en:"in my opinion",ex:"Meiner Meinung nach ist das falsch.",exEn:"In my opinion that's wrong.",diff:"medium"},
      {de:"ich finde",en:"I think / I find",ex:"Ich finde das Buch super.",exEn:"I think the book is great.",diff:"easy"},
      {de:"der Ärger",en:"trouble / annoyance",ex:"Er macht nur Ärger.",exEn:"He only makes trouble.",diff:"medium"},
      {de:"sich wohlfühlen",en:"to feel good / comfortable",ex:"Ich fühle mich hier wohl.",exEn:"I feel comfortable here.",diff:"medium",hint:"reflexive"},
      {de:"Recht haben",en:"to be right",ex:"Du hast völlig Recht.",exEn:"You're totally right.",diff:"easy"}
    ],
  "Everyday Actions": [
    {de:"aufstehen",en:"to get up",ex:"Ich stehe um sechs auf.",exEn:"I get up at six.",diff:"medium"},{de:"sich anziehen",en:"to get dressed",ex:"Ich ziehe mich schnell an.",exEn:"I get dressed quickly.",diff:"hard"},{de:"sich waschen",en:"to wash oneself",ex:"Ich wasche mich morgens.",exEn:"I wash up in the morning.",diff:"medium"},{de:"putzen",en:"to clean",ex:"Ich muss die Wohnung putzen.",exEn:"I have to clean the flat.",diff:"easy"},{de:"kochen",en:"to cook",ex:"Ich koche Abendessen.",exEn:"I'm cooking dinner.",diff:"easy"},{de:"einkaufen",en:"to go shopping",ex:"Ich gehe einkaufen.",exEn:"I'm going shopping.",diff:"medium"},{de:"anrufen",en:"to call (phone)",ex:"Ich rufe dich morgen an.",exEn:"I'll call you tomorrow.",diff:"medium",hint:"Separable: an·rufen — ich rufe … an"},{de:"sich setzen",en:"to sit down",ex:"Bitte setzen Sie sich.",exEn:"Please sit down.",diff:"medium"},{de:"aufhören",en:"to stop / cease",ex:"Hör bitte auf!",exEn:"Please stop!",diff:"medium"},{de:"anfangen",en:"to start / begin",ex:"Wann fangen wir an?",exEn:"When do we start?",diff:"medium"},{de:"vergessen",en:"to forget",ex:"Ich habe meinen Schlüssel vergessen.",exEn:"I forgot my key.",diff:"medium"},{de:"sich erinnern",en:"to remember",ex:"Ich erinnere mich daran.",exEn:"I remember that.",diff:"hard"},{de:"tragen",en:"to carry / wear",ex:"Ich trage einen Rucksack.",exEn:"I'm wearing a backpack.",diff:"easy"},{de:"zeigen",en:"to show",ex:"Können Sie mir das zeigen?",exEn:"Can you show me that?",diff:"easy"},{de:"legen",en:"to put / lay",ex:"Leg das Buch auf den Tisch.",exEn:"Put the book on the table.",diff:"medium"},{de:"stellen",en:"to put / place",ex:"Stell die Flasche in den Kühlschrank.",exEn:"Put the bottle in the fridge.",diff:"medium",hint:"legen = lay flat; stellen = stand upright"},{de:"hängen",en:"to hang",ex:"Das Bild hängt an der Wand.",exEn:"The picture is hanging on the wall.",diff:"medium"},{de:"benutzen",en:"to use",ex:"Kann ich dein Handy benutzen?",exEn:"Can I use your phone?",diff:"medium"},{de:"reparieren",en:"to repair",ex:"Ich muss das Auto reparieren.",exEn:"I have to repair the car.",diff:"easy"},{de:"teilen",en:"to share / divide",ex:"Wir teilen die Rechnung.",exEn:"We're splitting the bill.",diff:"easy"},{de:"lächeln",en:"to smile",ex:"Sie lächelt immer.",exEn:"She always smiles.",diff:"medium"},{de:"weinen",en:"to cry",ex:"Das Kind weint.",exEn:"The child is crying.",diff:"easy"},{de:"lachen",en:"to laugh",ex:"Wir haben viel gelacht.",exEn:"We laughed a lot.",diff:"easy"},{de:"sich ausruhen",en:"to rest",ex:"Am Sonntag ruhe ich mich aus.",exEn:"On Sunday I rest.",diff:"hard"},{de:"träumen",en:"to dream",ex:"Ich träume von einer Reise.",exEn:"I'm dreaming of a trip.",diff:"medium"},{de:"abschließen",en:"to lock",ex:"Vergiss nicht abzuschließen.",exEn:"Don't forget to lock up.",diff:"hard"},{de:"sich rasieren",en:"to shave",ex:"Ich rasiere mich jeden Morgen.",exEn:"I shave every morning.",diff:"medium"},{de:"bügeln",en:"to iron",ex:"Ich muss das Hemd bügeln.",exEn:"I have to iron the shirt.",diff:"medium"},{de:"einpacken",en:"to pack / wrap",ex:"Hast du alles eingepackt?",exEn:"Did you pack everything?",diff:"medium"},{de:"sich umziehen",en:"to change clothes",ex:"Ich muss mich umziehen.",exEn:"I have to change clothes.",diff:"hard"},{de:"frühstücken",en:"to eat breakfast",ex:"Ich frühstücke um sieben.",exEn:"I have breakfast at seven.",diff:"medium"},{de:"spülen",en:"to wash up",ex:"Ich spüle nach dem Essen.",exEn:"I wash up after eating.",diff:"easy"},{de:"abtrocknen",en:"to dry",ex:"Trockne bitte die Teller ab.",exEn:"Please dry the plates.",diff:"medium"},{de:"staubsaugen",en:"to vacuum",ex:"Ich sauge jeden Samstag Staub.",exEn:"I vacuum every Saturday.",diff:"hard",hint:"Staub (dust) + saugen (to suck)"},{de:"falten",en:"to fold",ex:"Ich falte die Wäsche.",exEn:"I'm folding the laundry.",diff:"medium"},{de:"gießen",en:"to water / pour",ex:"Ich gieße die Blumen.",exEn:"I'm watering the flowers.",diff:"medium"},{de:"klopfen",en:"to knock",ex:"Es hat jemand an die Tür geklopft.",exEn:"Someone knocked on the door.",diff:"medium"},{de:"drücken",en:"to press / push",ex:"Drück den Knopf.",exEn:"Press the button.",diff:"medium"},{de:"ziehen",en:"to pull",ex:"Zieh die Tür nach innen.",exEn:"Pull the door inward.",diff:"easy"},{de:"werfen",en:"to throw",ex:"Wirf mir den Ball!",exEn:"Throw me the ball!",diff:"easy"},{de:"fangen",en:"to catch",ex:"Kannst du den Ball fangen?",exEn:"Can you catch the ball?",diff:"easy"},{de:"heben",en:"to lift",ex:"Heb die Kiste vorsichtig.",exEn:"Lift the box carefully.",diff:"medium"},{de:"reinigen",en:"to clean (thoroughly)",ex:"Ich muss die Schuhe reinigen.",exEn:"I have to clean the shoes.",diff:"medium"},{de:"sortieren",en:"to sort",ex:"Ich sortiere die Bücher nach Farbe.",exEn:"I'm sorting the books by colour.",diff:"medium"},{de:"aufräumen",en:"to tidy up",ex:"Räum dein Zimmer auf!",exEn:"Tidy your room!",diff:"medium"},
  ,
      {de:"spazieren gehen",en:"to go for a walk",ex:"Wir gehen jeden Abend spazieren.",exEn:"We go for a walk every evening.",diff:"easy"},
      {de:"ins Bett gehen",en:"to go to bed",ex:"Ich gehe um elf ins Bett.",exEn:"I go to bed at eleven.",diff:"easy"},
      {de:"aufwachen",en:"to wake up",ex:"Ich wache um sechs auf.",exEn:"I wake up at six.",diff:"easy",hint:"separable verb"},
      {de:"einschlafen",en:"to fall asleep",ex:"Ich kann nicht einschlafen.",exEn:"I can't fall asleep.",diff:"medium",hint:"separable verb"},
      {de:"sich die Zähne putzen",en:"to brush one's teeth",ex:"Vergiss nicht, dir die Zähne zu putzen.",exEn:"Don't forget to brush your teeth.",diff:"medium",hint:"reflexive + dative"},
      {de:"duschen",en:"to shower",ex:"Ich dusche jeden Morgen.",exEn:"I shower every morning.",diff:"easy"},
      {de:"baden",en:"to bathe / take a bath",ex:"Das Kind badet gern.",exEn:"The child loves bathing.",diff:"easy"},
      {de:"sich die Haare waschen",en:"to wash one's hair",ex:"Ich wasche mir die Haare.",exEn:"I'm washing my hair.",diff:"medium",hint:"reflexive + dative"},
      {de:"Wäsche waschen",en:"to do laundry",ex:"Heute muss ich Wäsche waschen.",exEn:"Today I have to do the laundry.",diff:"medium"},
      {de:"den Tisch decken",en:"to set the table",ex:"Kannst du den Tisch decken?",exEn:"Can you set the table?",diff:"medium"}
    ],
  "Work & Study": [
    {de:"die Arbeit",en:"work / job",ex:"Ich gehe zur Arbeit.",exEn:"I'm going to work.",diff:"easy"},{de:"das Büro",en:"office",ex:"Mein Büro ist klein.",exEn:"My office is small.",diff:"easy"},{de:"der Computer",en:"computer",ex:"Ich arbeite am Computer.",exEn:"I work on the computer.",diff:"easy"},{de:"das Handy",en:"mobile phone",ex:"Wo ist mein Handy?",exEn:"Where is my phone?",diff:"easy"},{de:"die E-Mail",en:"email",ex:"Ich schreibe eine E-Mail.",exEn:"I'm writing an email.",diff:"easy"},{de:"die Schule",en:"school",ex:"Die Kinder gehen zur Schule.",exEn:"The children go to school.",diff:"easy"},{de:"die Universität",en:"university",ex:"Er studiert an der Universität.",exEn:"He studies at the university.",diff:"medium"},{de:"die Prüfung",en:"exam",ex:"Die Prüfung ist nächste Woche.",exEn:"The exam is next week.",diff:"medium"},{de:"die Aufgabe",en:"task / assignment",ex:"Das ist eine schwierige Aufgabe.",exEn:"That's a difficult task.",diff:"medium"},{de:"die Lösung",en:"solution",ex:"Wir brauchen eine Lösung.",exEn:"We need a solution.",diff:"medium"},{de:"die Besprechung",en:"meeting",ex:"Die Besprechung ist um zehn.",exEn:"The meeting is at ten.",diff:"hard",hint:"besprechen (to discuss) → Besprechung"},{de:"das Projekt",en:"project",ex:"Das Projekt ist fast fertig.",exEn:"The project is almost done.",diff:"easy"},{de:"der Termin",en:"appointment",ex:"Ich habe einen Termin um drei.",exEn:"I have an appointment at three.",diff:"medium"},{de:"erklären",en:"to explain",ex:"Kannst du das erklären?",exEn:"Can you explain that?",diff:"medium"},{de:"üben",en:"to practise",ex:"Ich muss mehr üben.",exEn:"I need to practise more.",diff:"easy"},{de:"die Erfahrung",en:"experience",ex:"Ich habe viel Erfahrung.",exEn:"I have a lot of experience.",diff:"hard",hint:"er- + fahren (to travel/experience)"},{de:"verbessern",en:"to improve",ex:"Ich will mein Deutsch verbessern.",exEn:"I want to improve my German.",diff:"hard"},{de:"die Herausforderung",en:"challenge",ex:"Das ist eine große Herausforderung.",exEn:"That's a big challenge.",diff:"hard",hint:"heraus (out) + fordern (to demand)"},{de:"das Ziel",en:"goal / target",ex:"Mein Ziel ist klar.",exEn:"My goal is clear.",diff:"easy"},{de:"der Fehler",en:"mistake / error",ex:"Jeder macht Fehler.",exEn:"Everyone makes mistakes.",diff:"easy"},{de:"die Bewerbung",en:"application (job)",ex:"Ich schreibe eine Bewerbung.",exEn:"I'm writing an application.",diff:"hard"},{de:"das Gehalt",en:"salary",ex:"Das Gehalt ist gut.",exEn:"The salary is good.",diff:"medium"},{de:"die Ausbildung",en:"training / apprenticeship",ex:"Meine Ausbildung dauert drei Jahre.",exEn:"My training lasts three years.",diff:"hard",hint:"aus- (out) + Bildung (education/formation)"},{de:"zuständig",en:"responsible / in charge",ex:"Wer ist dafür zuständig?",exEn:"Who's responsible for this?",diff:"hard"},{de:"das Ergebnis",en:"result",ex:"Das Ergebnis ist gut.",exEn:"The result is good.",diff:"hard"},{de:"die Frist",en:"deadline",ex:"Die Frist ist nächsten Freitag.",exEn:"The deadline is next Friday.",diff:"medium"},{de:"der Lebenslauf",en:"CV / resume",ex:"Schick mir deinen Lebenslauf.",exEn:"Send me your CV.",diff:"hard",hint:"Leben (life) + Lauf (course/run)"},{de:"die Überstunden",en:"overtime",ex:"Ich mache heute Überstunden.",exEn:"I'm doing overtime today.",diff:"hard",hint:"über (over) + Stunden (hours)"},{de:"der Bericht",en:"report",ex:"Der Bericht muss fertig werden.",exEn:"The report needs to be finished.",diff:"medium"},{de:"die Kenntnisse",en:"skills / knowledge",ex:"Er hat gute Deutschkenntnisse.",exEn:"He has good German skills.",diff:"hard",hint:"kennen (to know) → Kenntnis"},{de:"die Karriere",en:"career",ex:"Er hat eine große Karriere vor sich.",exEn:"He has a big career ahead of him.",diff:"easy"},{de:"der Beruf",en:"profession",ex:"Was ist Ihr Beruf?",exEn:"What's your profession?",diff:"easy"},{de:"der Lehrer",en:"teacher (m)",ex:"Mein Lehrer ist sehr streng.",exEn:"My teacher is very strict.",diff:"easy"},{de:"die Lehrerin",en:"teacher (f)",ex:"Meine Deutschlehrerin kommt aus Berlin.",exEn:"My German teacher is from Berlin.",diff:"easy"},{de:"der Schüler",en:"pupil (m)",ex:"Die Schüler schreiben einen Test.",exEn:"The pupils are writing a test.",diff:"easy"},{de:"der Student",en:"student",ex:"Ich bin Student in München.",exEn:"I'm a student in Munich.",diff:"easy"},{de:"der Ingenieur",en:"engineer",ex:"Ich arbeite als Ingenieur.",exEn:"I work as an engineer.",diff:"medium"},{de:"der Anwalt",en:"lawyer",ex:"Mein Anwalt hilft mir.",exEn:"My lawyer is helping me.",diff:"medium"},{de:"der Verkäufer",en:"salesperson",ex:"Der Verkäufer ist sehr freundlich.",exEn:"The salesperson is very friendly.",diff:"medium"},{de:"der Drucker",en:"printer",ex:"Der Drucker funktioniert nicht.",exEn:"The printer isn't working.",diff:"medium"},{de:"die Tastatur",en:"keyboard",ex:"Meine Tastatur ist kaputt.",exEn:"My keyboard is broken.",diff:"medium"},{de:"der Bildschirm",en:"screen",ex:"Der Bildschirm ist zu hell.",exEn:"The screen is too bright.",diff:"medium",hint:"Bild (picture) + Schirm (shield)"},{de:"die Datei",en:"file",ex:"Speichere die Datei bitte.",exEn:"Please save the file.",diff:"easy"},{de:"der Ordner",en:"folder",ex:"Leg die Dokumente in den Ordner.",exEn:"Put the documents in the folder.",diff:"easy"},{de:"speichern",en:"to save (file)",ex:"Speicher deine Arbeit oft!",exEn:"Save your work often!",diff:"easy"},{de:"löschen",en:"to delete",ex:"Lösch diese E-Mail, bitte.",exEn:"Delete this email, please.",diff:"easy"},{de:"abschicken",en:"to send off",ex:"Ich schicke die Bewerbung heute ab.",exEn:"I'm sending off the application today.",diff:"medium"},{de:"teilnehmen",en:"to participate",ex:"Ich nehme am Kurs teil.",exEn:"I'm taking part in the course.",diff:"hard"},{de:"die Kollegin",en:"colleague (f)",ex:"Meine Kollegin ist sehr hilfsbereit.",exEn:"My colleague is very helpful.",diff:"medium"},{de:"das Praktikum",en:"internship",ex:"Ich mache ein Praktikum bei einer Firma.",exEn:"I'm doing an internship at a company.",diff:"hard"},
  ,
      {de:"sich bewerben",en:"to apply (for a job)",ex:"Ich bewerbe mich um die Stelle.",exEn:"I'm applying for the position.",diff:"medium",hint:"reflexive"},
      {de:"das Meeting",en:"meeting",ex:"Das Meeting beginnt um zehn.",exEn:"The meeting starts at ten.",diff:"easy"},
      {de:"der Kunde",en:"customer / client",ex:"Der Kunde hat eine Frage.",exEn:"The customer has a question.",diff:"easy"},
      {de:"die Kundin",en:"customer (female)",ex:"Die Kundin wartet schon lange.",exEn:"The customer has been waiting a while.",diff:"easy"},
      {de:"die Rente",en:"pension / retirement",ex:"Mein Opa ist in Rente.",exEn:"My grandpa is retired.",diff:"medium"}
    ],
  "Connectors & Structure": [
    {de:"und",en:"and",ex:"Ich trinke Kaffee und esse Brot.",exEn:"I drink coffee and eat bread.",diff:"easy"},{de:"oder",en:"or",ex:"Tee oder Kaffee?",exEn:"Tea or coffee?",diff:"easy"},{de:"aber",en:"but",ex:"Ich bin müde, aber ich arbeite.",exEn:"I'm tired, but I'm working.",diff:"easy"},{de:"weil",en:"because",ex:"Ich lerne, weil ich es brauche.",exEn:"I'm studying because I need to.",diff:"medium",hint:"weil sends the verb to the END of the clause"},{de:"wenn",en:"if / when",ex:"Wenn es regnet, bleibe ich zu Hause.",exEn:"If it's raining, I'll stay home.",diff:"medium"},{de:"dass",en:"that (conjunction)",ex:"Ich denke, dass das richtig ist.",exEn:"I think that's right.",diff:"medium",hint:"dass sends verb to end; das = the/that (article/pronoun)"},{de:"obwohl",en:"although",ex:"Obwohl es kalt ist, gehe ich raus.",exEn:"Although it's cold, I'm going out.",diff:"hard"},{de:"deshalb",en:"therefore",ex:"Ich bin müde, deshalb gehe ich ins Bett.",exEn:"I'm tired, that's why I'm going to bed.",diff:"medium",hint:"Deshalb keeps V2 word order (verb 2nd)"},{de:"trotzdem",en:"nevertheless",ex:"Es regnet, trotzdem gehen wir.",exEn:"It's raining, we're going anyway.",diff:"hard"},{de:"außerdem",en:"besides / moreover",ex:"Außerdem brauche ich Milch.",exEn:"Besides, I need milk.",diff:"hard"},{de:"also",en:"so / therefore",ex:"Also, was machen wir jetzt?",exEn:"So, what are we doing now?",diff:"easy"},{de:"dann",en:"then",ex:"Zuerst essen wir, dann gehen wir.",exEn:"First we eat, then we go.",diff:"easy"},{de:"zuerst",en:"first",ex:"Zuerst mache ich die Hausaufgaben.",exEn:"First I do the homework.",diff:"easy"},{de:"danach",en:"after that",ex:"Danach gehe ich ins Bett.",exEn:"After that I go to bed.",diff:"medium"},{de:"bevor",en:"before",ex:"Bevor du gehst, ruf mich an.",exEn:"Before you leave, call me.",diff:"medium"},{de:"nachdem",en:"after (temporal)",ex:"Nachdem ich gegessen hatte, ging ich.",exEn:"After I ate, I left.",diff:"hard"},{de:"während",en:"while / during",ex:"Während ich koche, liest er.",exEn:"While I cook, he reads.",diff:"hard"},{de:"seit",en:"since / for (time)",ex:"Ich lerne Deutsch seit einem Jahr.",exEn:"I've been learning German for a year.",diff:"medium",hint:"seit + PRESENT tense (unlike English 'for' + present perfect)"},{de:"bis",en:"until",ex:"Warte bis morgen.",exEn:"Wait until tomorrow.",diff:"easy"},{de:"damit",en:"so that",ex:"Ich lerne, damit ich besser werde.",exEn:"I study so I get better.",diff:"hard"},{de:"falls",en:"in case / if",ex:"Falls du kommst, bring Kuchen mit.",exEn:"If you come, bring cake.",diff:"medium"},{de:"vielleicht",en:"maybe",ex:"Vielleicht regnet es morgen.",exEn:"Maybe it will rain tomorrow.",diff:"easy"},{de:"wahrscheinlich",en:"probably",ex:"Er kommt wahrscheinlich morgen.",exEn:"He'll probably come tomorrow.",diff:"hard"},{de:"eigentlich",en:"actually",ex:"Was machst du eigentlich?",exEn:"What do you actually do?",diff:"medium"},{de:"nämlich",en:"namely / you see",ex:"Ich bin nämlich krank.",exEn:"I'm ill, you see.",diff:"hard"},{de:"sowohl … als auch",en:"both … and",ex:"Sowohl Deutsch als auch Englisch.",exEn:"Both German and English.",diff:"hard"},{de:"weder … noch",en:"neither … nor",ex:"Weder er noch sie war da.",exEn:"Neither he nor she was there.",diff:"hard"},{de:"entweder … oder",en:"either … or",ex:"Entweder wir gehen oder bleiben.",exEn:"Either we go or we stay.",diff:"hard"},{de:"je … desto",en:"the … the",ex:"Je mehr du übst, desto besser.",exEn:"The more you practise, the better.",diff:"hard",hint:"je + comparative …, desto + comparative"},{de:"anstatt",en:"instead of",ex:"Anstatt zu arbeiten, ging er ins Kino.",exEn:"Instead of working, he went to the cinema.",diff:"hard"},{de:"sonst",en:"otherwise",ex:"Beeil dich, sonst kommen wir zu spät.",exEn:"Hurry up, or we'll be late.",diff:"medium"},{de:"außer",en:"except",ex:"Alle kommen außer Tom.",exEn:"Everyone's coming except Tom.",diff:"medium"},{de:"ohne",en:"without",ex:"Ich trinke Tee ohne Zucker.",exEn:"I drink tea without sugar.",diff:"easy"},{de:"nur",en:"only",ex:"Ich habe nur zehn Euro dabei.",exEn:"I only have ten euros on me.",diff:"easy"},{de:"schon",en:"already",ex:"Ich bin schon fertig.",exEn:"I'm already done.",diff:"easy"},{de:"noch",en:"still / yet",ex:"Ich habe noch nicht gegessen.",exEn:"I haven't eaten yet.",diff:"easy"},{de:"lieber",en:"rather",ex:"Ich trinke lieber Kaffee als Tee.",exEn:"I prefer coffee to tea.",diff:"medium"},{de:"zwar",en:"admittedly",ex:"Es ist zwar kalt, aber sonnig.",exEn:"It's cold, but sunny.",diff:"hard",hint:"zwar … aber = admittedly … but"},{de:"jedoch",en:"however (formal)",ex:"Er wollte kommen, jedoch war er krank.",exEn:"He wanted to come, however he was ill.",diff:"hard"},{de:"zum Beispiel",en:"for example",ex:"Ich mag Obst, zum Beispiel Äpfel.",exEn:"I like fruit, for example apples.",diff:"medium"},
  ,
      {de:"zum Schluss",en:"finally / in the end",ex:"Zum Schluss haben wir Kaffee getrunken.",exEn:"In the end we drank coffee.",diff:"medium"},
      {de:"einerseits … andererseits",en:"on one hand … on the other hand",ex:"Einerseits ist es billig, andererseits nicht so gut.",exEn:"On one hand it's cheap, on the other not so good.",diff:"hard"},
      {de:"erstens",en:"firstly",ex:"Erstens habe ich keine Zeit.",exEn:"Firstly, I have no time.",diff:"medium"},
      {de:"zweitens",en:"secondly",ex:"Zweitens ist es zu teuer.",exEn:"Secondly, it's too expensive.",diff:"medium"},
      {de:"im Gegensatz zu",en:"in contrast to",ex:"Im Gegensatz zu dir mag ich Kaffee.",exEn:"Unlike you, I like coffee.",diff:"hard"},
      {de:"beziehungsweise",en:"or rather / respectively",ex:"Ich komme am Freitag beziehungsweise am Samstag.",exEn:"I'm coming on Friday or Saturday.",diff:"hard",hint:"often shortened to 'bzw.'"},
      {de:"und so weiter",en:"and so on",ex:"Ich brauche Brot, Milch, Eier und so weiter.",exEn:"I need bread, milk, eggs and so on.",diff:"medium",hint:"often shortened to 'usw.'"},
      {de:"normalerweise",en:"normally / usually",ex:"Normalerweise esse ich um sieben.",exEn:"I usually eat at seven.",diff:"medium"},
      {de:"plötzlich",en:"suddenly",ex:"Plötzlich hat es angefangen zu regnen.",exEn:"Suddenly it started raining.",diff:"medium"},
      {de:"sofort",en:"immediately",ex:"Komm sofort her!",exEn:"Come here immediately!",diff:"easy"}
    ],
  "Abstract & Advanced": [
    {de:"die Entwicklung",en:"development",ex:"Die Entwicklung geht schnell.",exEn:"Development is going fast.",diff:"hard"},{de:"die Gesellschaft",en:"society",ex:"Die Gesellschaft verändert sich.",exEn:"Society is changing.",diff:"hard"},{de:"der Einfluss",en:"influence",ex:"Der Einfluss ist groß.",exEn:"The influence is great.",diff:"hard"},{de:"die Eigenschaft",en:"property / characteristic",ex:"Das hat besondere Eigenschaften.",exEn:"It has special properties.",diff:"hard"},{de:"grundsätzlich",en:"fundamentally",ex:"Grundsätzlich bin ich einverstanden.",exEn:"Basically I agree.",diff:"hard"},{de:"wesentlich",en:"essential / significant",ex:"Das ist ein wesentlicher Unterschied.",exEn:"That's an essential difference.",diff:"hard"},{de:"berücksichtigen",en:"to take into account",ex:"Man muss alles berücksichtigen.",exEn:"You have to consider everything.",diff:"hard"},{de:"beitragen",en:"to contribute",ex:"Jeder kann etwas beitragen.",exEn:"Everyone can contribute something.",diff:"hard"},{de:"sich ergeben",en:"to result / arise",ex:"Daraus ergibt sich eine Frage.",exEn:"This raises a question.",diff:"hard"},{de:"die Voraussetzung",en:"prerequisite",ex:"Das ist eine wichtige Voraussetzung.",exEn:"That's an important requirement.",diff:"hard",hint:"voraus (ahead) + Setzung (setting)"},{de:"der Zusammenhang",en:"context / connection",ex:"In diesem Zusammenhang ist es wichtig.",exEn:"In this context it's important.",diff:"hard"},{de:"die Erkenntnis",en:"insight / realisation",ex:"Das war eine wichtige Erkenntnis.",exEn:"That was an important insight.",diff:"hard"},{de:"die Darstellung",en:"representation",ex:"Die Darstellung war genau.",exEn:"The depiction was accurate.",diff:"hard"},{de:"der Hinweis",en:"hint / note",ex:"Danke für den Hinweis.",exEn:"Thanks for the tip.",diff:"hard"},{de:"die Veranstaltung",en:"event / function",ex:"Die Veranstaltung beginnt um acht.",exEn:"The event begins at eight.",diff:"hard"},{de:"die Bedeutung",en:"meaning / significance",ex:"Was ist die Bedeutung?",exEn:"What is the meaning?",diff:"hard"},{de:"sich entscheiden",en:"to decide",ex:"Ich kann mich nicht entscheiden.",exEn:"I can't decide.",diff:"hard"},{de:"bemerken",en:"to notice",ex:"Hast du den Fehler bemerkt?",exEn:"Did you notice the mistake?",diff:"hard"},{de:"die Umgebung",en:"surroundings",ex:"Die Umgebung ist sehr schön.",exEn:"The surroundings are very beautiful.",diff:"hard"},{de:"jedenfalls",en:"in any case",ex:"Jedenfalls müssen wir gehen.",exEn:"In any case we have to go.",diff:"hard"},{de:"allerdings",en:"however",ex:"Das war gut, allerdings teuer.",exEn:"That was good, but expensive.",diff:"hard"},{de:"inzwischen",en:"meanwhile / by now",ex:"Inzwischen hat sich viel geändert.",exEn:"In the meantime a lot has changed.",diff:"hard"},{de:"die Auseinandersetzung",en:"dispute / engagement",ex:"Eine kritische Auseinandersetzung.",exEn:"A critical examination.",diff:"hard"},{de:"solange",en:"as long as",ex:"Solange du lernst, wirst du besser.",exEn:"As long as you study, you'll get better.",diff:"hard"},{de:"die Schaltung",en:"circuit",ex:"Die Schaltung muss geprüft werden.",exEn:"The circuit needs to be tested.",diff:"hard"},{de:"die Steuerung",en:"control system",ex:"Die Steuerung ist automatisiert.",exEn:"The control is automated.",diff:"hard"},{de:"die Spannung",en:"voltage / tension",ex:"Die Spannung beträgt 230 Volt.",exEn:"The voltage is 230 volts.",diff:"hard"},{de:"der Anschluss",en:"connection / terminal",ex:"Der Anschluss muss geprüft werden.",exEn:"The connection needs to be checked.",diff:"hard"},{de:"die Wartung",en:"maintenance",ex:"Die Wartung ist am Montag.",exEn:"The maintenance is on Monday.",diff:"hard"},{de:"der Betrieb",en:"operation / company",ex:"Der Betrieb läuft gut.",exEn:"The operation is running well.",diff:"hard"},{de:"die Wahrheit",en:"truth",ex:"Sag mir die Wahrheit!",exEn:"Tell me the truth!",diff:"easy"},{de:"die Gerechtigkeit",en:"justice",ex:"Gerechtigkeit ist wichtig in jeder Gesellschaft.",exEn:"Justice is important in every society.",diff:"hard"},{de:"die Verantwortung",en:"responsibility",ex:"Er übernimmt die Verantwortung.",exEn:"He takes responsibility.",diff:"hard"},{de:"die Gesundheit",en:"health",ex:"Gesundheit ist das Wichtigste.",exEn:"Health is the most important thing.",diff:"easy"},{de:"die Bildung",en:"education",ex:"Bildung öffnet Türen.",exEn:"Education opens doors.",diff:"medium"},{de:"das Wissen",en:"knowledge",ex:"Sein Wissen ist beeindruckend.",exEn:"His knowledge is impressive.",diff:"medium"},{de:"der Erfolg",en:"success",ex:"Der Erfolg kommt mit harter Arbeit.",exEn:"Success comes with hard work.",diff:"easy"},{de:"das Glück",en:"luck / happiness",ex:"Viel Glück bei der Prüfung!",exEn:"Good luck with the exam!",diff:"easy"},{de:"die Möglichkeit",en:"possibility",ex:"Es gibt viele Möglichkeiten.",exEn:"There are many possibilities.",diff:"easy"},{de:"die Wirklichkeit",en:"reality",ex:"In der Wirklichkeit ist es anders.",exEn:"In reality it's different.",diff:"medium"},{de:"der Fortschritt",en:"progress",ex:"Wir machen große Fortschritte.",exEn:"We're making great progress.",diff:"medium"},{de:"die Gewohnheit",en:"habit",ex:"Alte Gewohnheiten sind schwer zu ändern.",exEn:"Old habits are hard to change.",diff:"medium"},{de:"der Wunsch",en:"wish",ex:"Mein größter Wunsch ist zu reisen.",exEn:"My biggest wish is to travel.",diff:"easy"},{de:"das Geheimnis",en:"secret",ex:"Kannst du ein Geheimnis bewahren?",exEn:"Can you keep a secret?",diff:"medium"},{de:"die Zukunft",en:"future",ex:"Niemand kennt die Zukunft.",exEn:"No one knows the future.",diff:"easy"},
  ],
  "Media & Communication": [
    {de:"das Fernsehen",en:"television",ex:"Ich schaue Fernsehen am Abend.",exEn:"I watch TV in the evening.",diff:"easy"},{de:"das Radio",en:"radio",ex:"Im Radio läuft gute Musik.",exEn:"Good music is on the radio.",diff:"easy"},{de:"die Zeitung",en:"newspaper",ex:"Ich lese die Zeitung morgens.",exEn:"I read the newspaper in the morning.",diff:"easy"},{de:"die Zeitschrift",en:"magazine",ex:"Ich abonniere eine Zeitschrift.",exEn:"I subscribe to a magazine.",diff:"medium"},{de:"das Buch",en:"book",ex:"Das Buch ist sehr interessant.",exEn:"The book is very interesting.",diff:"easy"},{de:"die Nachricht",en:"message / news item",ex:"Ich habe eine wichtige Nachricht für dich.",exEn:"I have important news for you.",diff:"easy"},{de:"die Nachrichten",en:"news (plural)",ex:"Die Nachrichten um 20 Uhr.",exEn:"The news at 8pm.",diff:"easy"},{de:"der Artikel",en:"article",ex:"Ich habe einen Artikel gelesen.",exEn:"I read an article.",diff:"easy"},{de:"der Brief",en:"letter",ex:"Ich schreibe meiner Oma einen Brief.",exEn:"I'm writing my grandma a letter.",diff:"easy"},{de:"die Postkarte",en:"postcard",ex:"Ich schicke dir eine Postkarte aus Paris.",exEn:"I'll send you a postcard from Paris.",diff:"easy"},{de:"die Briefmarke",en:"stamp",ex:"Ich brauche eine Briefmarke.",exEn:"I need a stamp.",diff:"medium"},{de:"der Umschlag",en:"envelope",ex:"Der Brief ist im Umschlag.",exEn:"The letter is in the envelope.",diff:"medium"},{de:"das Internet",en:"internet",ex:"Ohne Internet geht heute nichts.",exEn:"Without internet nothing works today.",diff:"easy"},{de:"die Webseite",en:"website",ex:"Die Webseite ist leicht zu benutzen.",exEn:"The website is easy to use.",diff:"easy"},{de:"der Link",en:"link",ex:"Klick auf den Link.",exEn:"Click the link.",diff:"easy"},{de:"der Anruf",en:"phone call",ex:"Ich erwarte einen Anruf.",exEn:"I'm expecting a call.",diff:"easy"},{de:"die Telefonnummer",en:"phone number",ex:"Was ist deine Telefonnummer?",exEn:"What's your phone number?",diff:"easy"},{de:"das Passwort",en:"password",ex:"Ich habe mein Passwort vergessen.",exEn:"I forgot my password.",diff:"medium"},{de:"das Foto",en:"photo",ex:"Mach ein Foto von uns.",exEn:"Take a photo of us.",diff:"easy"},{de:"das Video",en:"video",ex:"Das Video ist sehr lustig.",exEn:"The video is very funny.",diff:"easy"},{de:"die Musik",en:"music",ex:"Ich höre gerne Musik.",exEn:"I love listening to music.",diff:"easy"},{de:"das Lied",en:"song",ex:"Das ist mein Lieblingslied.",exEn:"That's my favourite song.",diff:"easy"},{de:"der Film",en:"film / movie",ex:"Der Film war spannend.",exEn:"The film was exciting.",diff:"easy"},{de:"die Serie",en:"series",ex:"Welche Serie schaust du gerade?",exEn:"Which series are you watching now?",diff:"easy"},{de:"der Kanal",en:"channel",ex:"Welcher Kanal ist das?",exEn:"Which channel is that?",diff:"medium"},{de:"die Sendung",en:"broadcast / show",ex:"Die Sendung beginnt um 20 Uhr.",exEn:"The show starts at 8pm.",diff:"medium"},{de:"drucken",en:"to print",ex:"Kannst du das bitte drucken?",exEn:"Can you print that, please?",diff:"easy"},{de:"veröffentlichen",en:"to publish",ex:"Sie veröffentlicht ihr erstes Buch.",exEn:"She's publishing her first book.",diff:"hard"},{de:"schicken",en:"to send",ex:"Schick mir eine Nachricht!",exEn:"Send me a message!",diff:"easy"},{de:"empfangen",en:"to receive",ex:"Ich habe deine E-Mail empfangen.",exEn:"I received your email.",diff:"medium"},{de:"kommentieren",en:"to comment",ex:"Bitte kommentieren Sie meinen Beitrag.",exEn:"Please comment on my post.",diff:"medium"},{de:"folgen",en:"to follow",ex:"Ich folge dir auf Instagram.",exEn:"I'm following you on Instagram.",diff:"easy"},{de:"abonnieren",en:"to subscribe",ex:"Abonniere meinen Kanal!",exEn:"Subscribe to my channel!",diff:"medium"},{de:"herunterladen",en:"to download",ex:"Ich lade die Datei herunter.",exEn:"I'm downloading the file.",diff:"medium"},{de:"hochladen",en:"to upload",ex:"Lade das Foto hoch.",exEn:"Upload the photo.",diff:"medium"},{de:"chatten",en:"to chat",ex:"Wir chatten jeden Abend.",exEn:"We chat every evening.",diff:"easy"},{de:"der Podcast",en:"podcast",ex:"Ich höre einen Podcast beim Joggen.",exEn:"I listen to a podcast while jogging.",diff:"easy"},{de:"die Reklame",en:"advertisement",ex:"Die Reklame nervt mich.",exEn:"The advert annoys me.",diff:"medium"},{de:"berichten",en:"to report",ex:"Die Zeitung berichtet darüber.",exEn:"The newspaper reports on it.",diff:"medium"},
  ,
      {de:"der Fernsehsender",en:"TV channel",ex:"Welchen Fernsehsender schaust du gern?",exEn:"Which TV channel do you like to watch?",diff:"medium"},
      {de:"die Schlagzeile",en:"headline",ex:"Die Schlagzeile war sehr interessant.",exEn:"The headline was very interesting.",diff:"medium"},
      {de:"der Empfänger",en:"recipient",ex:"Der Empfänger hat die E-Mail bekommen.",exEn:"The recipient got the email.",diff:"medium"},
      {de:"der Absender",en:"sender",ex:"Wer ist der Absender dieses Briefs?",exEn:"Who is the sender of this letter?",diff:"medium"},
      {de:"die Werbung",en:"advertisement / commercial",ex:"Die Werbung im Fernsehen nervt mich.",exEn:"TV ads annoy me.",diff:"easy"},
      {de:"der Beitrag",en:"post / article",ex:"Ich habe deinen Beitrag gelesen.",exEn:"I read your post.",diff:"medium"},
      {de:"der Kommentar",en:"comment",ex:"Schreib bitte einen Kommentar.",exEn:"Please write a comment.",diff:"easy"},
      {de:"das Telefongespräch",en:"phone call",ex:"Das Telefongespräch war sehr lang.",exEn:"The phone call was very long.",diff:"medium"},
      {de:"zurückrufen",en:"to call back",ex:"Kannst du mich morgen zurückrufen?",exEn:"Can you call me back tomorrow?",diff:"medium",hint:"separable verb"},
      {de:"auflegen",en:"to hang up (phone)",ex:"Leg bitte nicht auf!",exEn:"Please don't hang up!",diff:"medium",hint:"separable verb"},
      {de:"der Abonnent",en:"subscriber",ex:"Der Kanal hat viele Abonnenten.",exEn:"The channel has many subscribers.",diff:"medium"}
    ],
  "Sport & Leisure": [
    {de:"der Sport",en:"sport",ex:"Sport ist gut für die Gesundheit.",exEn:"Sport is good for health.",diff:"easy"},{de:"der Fußball",en:"football / soccer",ex:"Ich spiele gerne Fußball.",exEn:"I enjoy playing football.",diff:"easy"},{de:"das Tor",en:"goal (sport) / gate",ex:"Er hat ein Tor geschossen!",exEn:"He scored a goal!",diff:"easy"},{de:"das Spiel",en:"game / match",ex:"Das Spiel beginnt um 15 Uhr.",exEn:"The game starts at 3pm.",diff:"easy"},{de:"der Spieler",en:"player",ex:"Der Spieler ist sehr talentiert.",exEn:"The player is very talented.",diff:"easy"},{de:"die Mannschaft",en:"team",ex:"Unsere Mannschaft hat gewonnen.",exEn:"Our team won.",diff:"medium"},{de:"das Training",en:"training",ex:"Ich habe Training am Dienstag.",exEn:"I have training on Tuesday.",diff:"easy"},{de:"das Fitnessstudio",en:"gym",ex:"Ich gehe dreimal pro Woche ins Fitnessstudio.",exEn:"I go to the gym three times a week.",diff:"medium"},{de:"joggen",en:"to jog",ex:"Ich jogge jeden Morgen.",exEn:"I jog every morning.",diff:"easy"},{de:"schwimmen",en:"to swim",ex:"Ich schwimme im Meer.",exEn:"I swim in the sea.",diff:"easy"},{de:"klettern",en:"to climb",ex:"Wir klettern an den Wochenenden.",exEn:"We climb on weekends.",diff:"medium"},{de:"wandern",en:"to hike",ex:"Wir wandern gerne in den Bergen.",exEn:"We love hiking in the mountains.",diff:"easy"},{de:"tanzen",en:"to dance",ex:"Sie tanzt wunderschön.",exEn:"She dances beautifully.",diff:"easy"},{de:"singen",en:"to sing",ex:"Er singt im Chor.",exEn:"He sings in the choir.",diff:"easy"},{de:"malen",en:"to paint",ex:"Mein Kind malt gern.",exEn:"My child likes to paint.",diff:"easy"},{de:"zeichnen",en:"to draw",ex:"Ich zeichne ein Porträt.",exEn:"I'm drawing a portrait.",diff:"medium"},{de:"fotografieren",en:"to photograph",ex:"Ich fotografiere die Landschaft.",exEn:"I'm photographing the landscape.",diff:"medium"},{de:"das Hobby",en:"hobby",ex:"Was ist dein Hobby?",exEn:"What's your hobby?",diff:"easy"},{de:"die Freizeit",en:"free time",ex:"In meiner Freizeit lese ich.",exEn:"In my free time I read.",diff:"easy"},{de:"das Konzert",en:"concert",ex:"Das Konzert war fantastisch.",exEn:"The concert was fantastic.",diff:"easy"},{de:"das Theater",en:"theatre",ex:"Wir gehen heute ins Theater.",exEn:"We're going to the theatre today.",diff:"easy"},{de:"die Ausstellung",en:"exhibition",ex:"Die Ausstellung ist bis Mai geöffnet.",exEn:"The exhibition is open until May.",diff:"medium"},{de:"der Zoo",en:"zoo",ex:"Die Kinder lieben den Zoo.",exEn:"The children love the zoo.",diff:"easy"},{de:"die Bibliothek",en:"library",ex:"Ich lerne in der Bibliothek.",exEn:"I study at the library.",diff:"easy"},{de:"das Schwimmbad",en:"swimming pool",ex:"Das Schwimmbad ist geöffnet.",exEn:"The swimming pool is open.",diff:"medium"},{de:"das Brettspiel",en:"board game",ex:"Wir spielen ein Brettspiel.",exEn:"We're playing a board game.",diff:"medium"},{de:"der Ball",en:"ball",ex:"Wirf den Ball!",exEn:"Throw the ball!",diff:"easy"},{de:"das Ticket",en:"ticket",ex:"Das Ticket war sehr teuer.",exEn:"The ticket was very expensive.",diff:"easy"},{de:"sich entspannen",en:"to relax",ex:"Ich möchte mich entspannen.",exEn:"I want to relax.",diff:"medium"},{de:"genießen",en:"to enjoy",ex:"Ich genieße die Sonne.",exEn:"I'm enjoying the sun.",diff:"medium"},{de:"trainieren",en:"to train",ex:"Ich trainiere für einen Marathon.",exEn:"I'm training for a marathon.",diff:"easy"},{de:"der Verein",en:"club / society",ex:"Ich bin im Sportverein.",exEn:"I'm in a sports club.",diff:"medium"},{de:"die Meisterschaft",en:"championship",ex:"Die Meisterschaft ist im Juni.",exEn:"The championship is in June.",diff:"hard"},{de:"die Medaille",en:"medal",ex:"Sie hat eine Goldmedaille gewonnen.",exEn:"She won a gold medal.",diff:"medium"},{de:"sammeln",en:"to collect",ex:"Ich sammle Briefmarken.",exEn:"I collect stamps.",diff:"easy"},{de:"angeln",en:"to fish",ex:"Wir gehen am See angeln.",exEn:"We're going fishing at the lake.",diff:"easy"},{de:"reiten",en:"to ride (horse)",ex:"Mein Neffe lernt reiten.",exEn:"My nephew is learning to ride.",diff:"medium"},{de:"basteln",en:"to do crafts",ex:"Die Kinder basteln gern.",exEn:"The children love crafts.",diff:"medium"},{de:"das Lagerfeuer",en:"campfire",ex:"Wir sitzen am Lagerfeuer.",exEn:"We're sitting by the campfire.",diff:"hard"},
  ,
      {de:"das Tennis",en:"tennis",ex:"Ich spiele gern Tennis.",exEn:"I like playing tennis.",diff:"easy"},
      {de:"das Golf",en:"golf",ex:"Mein Vater spielt oft Golf.",exEn:"My father often plays golf.",diff:"easy"},
      {de:"das Yoga",en:"yoga",ex:"Ich mache jeden Morgen Yoga.",exEn:"I do yoga every morning.",diff:"easy"},
      {de:"der Marathon",en:"marathon",ex:"Sie läuft nächsten Monat einen Marathon.",exEn:"She's running a marathon next month.",diff:"medium"},
      {de:"die Wanderung",en:"hike",ex:"Die Wanderung war anstrengend, aber schön.",exEn:"The hike was tiring but lovely.",diff:"medium"},
      {de:"der Trainer",en:"coach / trainer",ex:"Unser Trainer ist sehr streng.",exEn:"Our coach is very strict.",diff:"easy"},
      {de:"das Turnier",en:"tournament",ex:"Das Turnier findet am Wochenende statt.",exEn:"The tournament is this weekend.",diff:"medium"},
      {de:"der Sieg",en:"victory",ex:"Wir feiern unseren Sieg!",exEn:"We're celebrating our victory!",diff:"medium"},
      {de:"die Niederlage",en:"defeat",ex:"Die Niederlage war knapp.",exEn:"The defeat was close.",diff:"medium"},
      {de:"unentschieden",en:"draw / tied",ex:"Das Spiel endete unentschieden.",exEn:"The game ended in a draw.",diff:"medium"},
      {de:"die Regel",en:"rule",ex:"Kennst du die Regeln?",exEn:"Do you know the rules?",diff:"easy"}
    ],
  "Technology & Digital": [
    {de:"die Technik",en:"technology",ex:"Moderne Technik macht vieles einfacher.",exEn:"Modern technology makes many things easier.",diff:"easy"},{de:"das Programm",en:"program",ex:"Starte das Programm.",exEn:"Start the program.",diff:"easy"},{de:"die App",en:"app",ex:"Lade die App herunter.",exEn:"Download the app.",diff:"easy"},{de:"die Software",en:"software",ex:"Die Software ist kostenlos.",exEn:"The software is free.",diff:"easy"},{de:"die Daten",en:"data",ex:"Die Daten sind wichtig.",exEn:"The data is important.",diff:"easy"},{de:"der Server",en:"server",ex:"Der Server ist offline.",exEn:"The server is offline.",diff:"easy"},{de:"die Datenbank",en:"database",ex:"Die Datenbank enthält alle Kundeninfos.",exEn:"The database contains all customer info.",diff:"medium"},{de:"der Akku",en:"battery",ex:"Mein Akku ist leer.",exEn:"My battery is empty.",diff:"medium"},{de:"das Ladegerät",en:"charger",ex:"Wo ist mein Ladegerät?",exEn:"Where is my charger?",diff:"medium"},{de:"laden",en:"to load / charge",ex:"Ich lade mein Handy.",exEn:"I'm charging my phone.",diff:"easy"},{de:"der Stecker",en:"plug",ex:"Der Stecker passt nicht.",exEn:"The plug doesn't fit.",diff:"medium"},{de:"das Kabel",en:"cable",ex:"Das USB-Kabel ist zu kurz.",exEn:"The USB cable is too short.",diff:"easy"},{de:"der Schalter",en:"switch",ex:"Drück den Schalter.",exEn:"Press the switch.",diff:"medium"},{de:"die Taste",en:"key (keyboard)",ex:"Welche Taste muss ich drücken?",exEn:"Which key do I press?",diff:"easy"},{de:"klicken",en:"to click",ex:"Klick auf das Symbol.",exEn:"Click the icon.",diff:"easy"},{de:"scrollen",en:"to scroll",ex:"Scroll nach unten.",exEn:"Scroll down.",diff:"easy"},{de:"suchen",en:"to search",ex:"Ich suche ein Rezept online.",exEn:"I'm looking for a recipe online.",diff:"easy"},{de:"die Suche",en:"search",ex:"Die Suche hat nichts ergeben.",exEn:"The search came up empty.",diff:"easy"},{de:"der Browser",en:"browser",ex:"Welchen Browser benutzt du?",exEn:"Which browser do you use?",diff:"easy"},{de:"das Smartphone",en:"smartphone",ex:"Mein Smartphone ist kaputt.",exEn:"My smartphone is broken.",diff:"easy"},{de:"die Kamera",en:"camera",ex:"Die Kamera macht tolle Fotos.",exEn:"The camera takes great photos.",diff:"easy"},{de:"der Lautsprecher",en:"loudspeaker",ex:"Der Lautsprecher ist zu laut.",exEn:"The speaker is too loud.",diff:"medium"},{de:"die Kopfhörer",en:"headphones",ex:"Ich höre Musik über Kopfhörer.",exEn:"I listen to music on headphones.",diff:"medium"},{de:"das WLAN",en:"wifi",ex:"Das WLAN ist kostenlos.",exEn:"The wifi is free.",diff:"easy"},{de:"das Netzwerk",en:"network",ex:"Das Netzwerk funktioniert nicht.",exEn:"The network isn't working.",diff:"medium"},{de:"das Gerät",en:"device",ex:"Welches Gerät benutzt du?",exEn:"Which device do you use?",diff:"easy"},{de:"aktualisieren",en:"to update",ex:"Ich muss die App aktualisieren.",exEn:"I have to update the app.",diff:"hard"},{de:"installieren",en:"to install",ex:"Installiere das Programm.",exEn:"Install the program.",diff:"medium"},{de:"neustarten",en:"to restart",ex:"Starte den Computer neu.",exEn:"Restart the computer.",diff:"medium"},{de:"funktionieren",en:"to function / work",ex:"Das funktioniert leider nicht.",exEn:"Unfortunately that doesn't work.",diff:"medium"},{de:"abstürzen",en:"to crash",ex:"Mein Computer ist abgestürzt.",exEn:"My computer crashed.",diff:"hard"},{de:"der Virus",en:"virus",ex:"Der Computer hat einen Virus.",exEn:"The computer has a virus.",diff:"easy"},{de:"sicher",en:"safe / secure",ex:"Ist die Seite sicher?",exEn:"Is the site secure?",diff:"easy"},{de:"die Sicherheit",en:"security",ex:"Die Sicherheit ist wichtig.",exEn:"Security is important.",diff:"medium"},{de:"der Nutzer",en:"user",ex:"Der Nutzer muss sich anmelden.",exEn:"The user must sign in.",diff:"medium"},{de:"anmelden",en:"to log in",ex:"Melde dich bitte an.",exEn:"Please sign in.",diff:"medium"},{de:"abmelden",en:"to log out",ex:"Vergiss nicht, dich abzumelden.",exEn:"Don't forget to log out.",diff:"medium"},{de:"die Ladezeit",en:"loading time",ex:"Die Ladezeit ist zu lang.",exEn:"The loading time is too long.",diff:"hard"},{de:"die Verbindung",en:"connection",ex:"Die Verbindung ist schlecht.",exEn:"The connection is bad.",diff:"medium"},
  ,
      {de:"die Maus",en:"mouse (computer)",ex:"Meine Maus funktioniert nicht.",exEn:"My mouse isn't working.",diff:"easy"},
      {de:"der Cursor",en:"cursor",ex:"Der Cursor bewegt sich nicht.",exEn:"The cursor doesn't move.",diff:"medium"},
      {de:"der USB-Stick",en:"USB stick",ex:"Ich habe die Datei auf dem USB-Stick.",exEn:"I have the file on the USB stick.",diff:"easy"},
      {de:"das Update",en:"update",ex:"Ein neues Update ist verfügbar.",exEn:"A new update is available.",diff:"easy"},
      {de:"kopieren",en:"to copy",ex:"Kopiere den Text und schicke ihn mir.",exEn:"Copy the text and send it to me.",diff:"easy"},
      {de:"einfügen",en:"to paste / insert",ex:"Füge das Bild hier ein.",exEn:"Paste the picture here.",diff:"medium",hint:"separable verb"},
      {de:"tippen",en:"to type",ex:"Er tippt sehr schnell.",exEn:"He types very fast.",diff:"easy"},
      {de:"einschalten",en:"to switch on",ex:"Schalte bitte den Computer ein.",exEn:"Please turn the computer on.",diff:"easy",hint:"separable verb"},
      {de:"ausschalten",en:"to switch off",ex:"Schalte das Licht aus!",exEn:"Turn off the light!",diff:"easy",hint:"separable verb"},
      {de:"die Einstellung",en:"setting",ex:"Ändere die Einstellungen im Menü.",exEn:"Change the settings in the menu.",diff:"medium"},
      {de:"drahtlos",en:"wireless",ex:"Die Verbindung ist drahtlos.",exEn:"The connection is wireless.",diff:"medium"}
    ],
};

// ── CLOZE DATA — UNCHANGED ──
const CLOZE = [
  {q:"Ich fahre mit ___ Bus.",a:"dem",h:"mit → dative. der Bus → dem"},{q:"Das ist für ___ Mutter.",a:"die",h:"für → accusative. die stays die"},{q:"Er geht in ___ Schule.",a:"die",h:"in + accusative (motion toward)"},{q:"Sie ist in ___ Schule.",a:"der",h:"in + dative (location)"},{q:"Ich helfe ___ Kind.",a:"dem",h:"helfen → dative. das → dem"},{q:"Er gibt ___ Frau das Buch.",a:"der",h:"Indirect object = dative. die → der"},{q:"Ich sehe ___ Mann.",a:"den",h:"sehen → accusative. der → den"},{q:"Wir gehen ___ dem Essen.",a:"nach",h:"nach dem Essen = after the meal"},{q:"Ich wohne ___ meiner Schwester.",a:"bei",h:"bei = at someone's place (dative)"},{q:"Er kommt ___ Deutschland.",a:"aus",h:"aus = from (country of origin)"},{q:"Das Buch liegt ___ dem Tisch.",a:"auf",h:"auf dem Tisch = on the table"},{q:"Ich gehe ___ den Supermarkt.",a:"in",h:"in + accusative (motion toward)"},{q:"Er wartet ___ den Bus.",a:"auf",h:"warten auf = to wait for"},{q:"Ich interessiere mich ___ Musik.",a:"für",h:"sich interessieren für"},{q:"Ich freue mich ___ das Wochenende.",a:"auf",h:"sich freuen auf = look forward to"},{q:"Ich freue mich ___ das Geschenk.",a:"über",h:"sich freuen über = happy about"},{q:"Er ___ gestern ins Kino gegangen.",a:"ist",h:"gehen → sein + gegangen"},{q:"Wir ___ gestern viel gelernt.",a:"haben",h:"lernen → haben + gelernt"},{q:"..., weil ich nach Berlin ___.",a:"fahre",h:"After weil: verb goes to end"},{q:"Wenn ich Zeit ___, gehe ich ins Kino.",a:"habe",h:"wenn-clause: verb at end"},{q:"Er ist krank. ___ bleibt er zu Hause.",a:"Deshalb",h:"Deshalb = therefore"},{q:"Ich denke, ___ das richtig ist.",a:"dass",h:"dass = that (sends verb to end)"},{q:"___ es regnet, gehen wir spazieren.",a:"Obwohl",h:"obwohl = although"},{q:"Ich muss morgen früh ___.",a:"aufstehen",h:"Modal → infinitive at end"},{q:"Er ___ sehr gut Deutsch sprechen.",a:"kann",h:"er → kann"},{q:"Du ___ nicht so schnell fahren!",a:"sollst",h:"du → sollst"},{q:"___ ich hier rauchen?",a:"Darf",h:"ich → darf"},{q:"Er ist ___ als sein Bruder.",a:"größer",h:"Comparative: groß → größer"},{q:"Ich ___ seit drei Jahren in Wales.",a:"wohne",h:"seit + present tense in German"},{q:"Er hat mir ___ gegeben.",a:"nichts",h:"nichts = nothing (as object)"},{q:"Ich habe keine Lust, heute zu ___.",a:"arbeiten",h:"zu + infinitive"},{q:"Das Buch gehört ___ Lehrer.",a:"dem",h:"gehören → dative. der → dem"},{q:"Sie fährt ___ ihrer Freundin.",a:"zu",h:"zu = to (a person, dative)"},{q:"Ich träume ___ einer Reise.",a:"von",h:"träumen von = dream of (dative)"},{q:"Er denkt ___ seine Familie.",a:"an",h:"denken an = think about (accusative)"},{q:"Ich habe ___ Hund.",a:"einen",h:"haben + accusative. der Hund → einen (masc. acc.)"},{q:"Siehst du ___ Mann dort?",a:"den",h:"sehen → accusative. der → den"},{q:"Ich lese ___ Buch.",a:"das",h:"das stays das in acc. neuter"},{q:"Er hat ___ Schwester.",a:"eine",h:"eine (fem. acc.) = eine"},{q:"Mit ___ Freund gehe ich ins Kino.",a:"meinem",h:"mit + dative masc. → meinem"},{q:"Nach ___ Arbeit bin ich müde.",a:"der",h:"nach + dative fem. → der"},{q:"Wir sprechen mit ___ Lehrerin.",a:"der",h:"mit + dative fem. → der"},{q:"Ich gebe ___ Kind ein Geschenk.",a:"dem",h:"geben indirect obj → dative. das → dem"},{q:"Das Geschenk ist für ___ Vater.",a:"meinen",h:"für + acc. masc. → meinen"},{q:"Ohne ___ Freundin kommt er nicht.",a:"seine",h:"ohne + acc. fem. → seine"},{q:"Ich lege das Buch ___ den Tisch.",a:"auf",h:"auf + accusative = motion toward"},{q:"Die Katze sitzt ___ dem Stuhl.",a:"unter",h:"unter + dative = location"},{q:"Das Bild hängt ___ der Wand.",a:"an",h:"an + dative = location (vertical)"},{q:"Ich hänge das Bild ___ die Wand.",a:"an",h:"an + accusative = motion"},{q:"Zwischen ___ zwei Bäumen steht eine Bank.",a:"den",h:"zwischen + dative pl. → den"},{q:"Wir fahren ___ die Berge.",a:"in",h:"in + accusative = motion toward"},{q:"Er arbeitet ___ der Küche.",a:"in",h:"in + dative = location"},{q:"Der Hund läuft ___ den Park.",a:"durch",h:"durch always takes accusative"},{q:"Wir gehen ___ den Fluss entlang.",a:"an",h:"an … entlang = along"},{q:"Meine Eltern ___ in Wales.",a:"wohnen",h:"sie (plural) → wohnen"},{q:"Du ___ gut Deutsch.",a:"sprichst",h:"du: sprechen → sprichst (stem-change e→i)"},{q:"Er ___ jeden Tag zur Arbeit.",a:"fährt",h:"fahren → fährt (a→ä)"},{q:"Was ___ du zum Frühstück?",a:"isst",h:"essen → du isst"},{q:"Ich ___ dich morgen.",a:"sehe",h:"ich → sehe"},{q:"Sie ___ einen Brief.",a:"schreibt",h:"sie (singular) → schreibt"},{q:"Ihr ___ immer zu spät.",a:"kommt",h:"ihr → kommt"},{q:"Wir ___ Deutsch seit einem Jahr.",a:"lernen",h:"wir → lernen"},{q:"Ich ___ heute nicht arbeiten.",a:"muss",h:"muss (ich-form of müssen)"},{q:"Was ___ ich tun?",a:"soll",h:"soll (ich-form of sollen) = what should I"},{q:"Er ___ sehr gut singen.",a:"kann",h:"können → er kann"},{q:"Wir ___ morgen frei haben.",a:"werden",h:"werden + infinitive = future"},{q:"Ich ___ gestern spazieren gegangen.",a:"bin",h:"gehen → sein + gegangen"},{q:"Er ___ viele Bücher gelesen.",a:"hat",h:"lesen → haben + gelesen"},{q:"Wir ___ um sieben aufgestanden.",a:"sind",h:"aufstehen → sein + aufgestanden"},{q:"Sie ___ uns geholfen.",a:"hat",h:"helfen → haben + geholfen"},{q:"Ich ___ zwei Stunden geschlafen.",a:"habe",h:"schlafen → haben + geschlafen"},{q:"Ich weiß, dass er heute ___.",a:"kommt",h:"dass sends verb to end"},{q:"Er fragt, ob wir Zeit ___.",a:"haben",h:"ob (if) sends verb to end"},{q:"Sie bleibt zu Hause, weil sie krank ___.",a:"ist",h:"weil → ist at end"},{q:"Als ich jung ___, spielte ich Klavier.",a:"war",h:"als + past tense"},{q:"Ich habe ___ Zeit.",a:"keine",h:"kein + fem. acc. → keine"},{q:"Er isst ___ Fleisch.",a:"kein",h:"kein + neut. acc. → kein"},{q:"Das ist ___ Problem.",a:"kein",h:"kein + neut. nom. → kein"},{q:"Der ___ Mann ist mein Onkel.",a:"alte",h:"der + masc. nom. → -e"},{q:"Ich trinke einen ___ Kaffee.",a:"heißen",h:"einen + masc. acc. adj. → -en"},{q:"Eine ___ Frau hat gefragt.",a:"nette",h:"eine + fem. nom. adj. → -e"},{q:"Mein Bruder ist ___ als ich.",a:"älter",h:"comparative of alt"},{q:"Berlin ist die ___ Stadt Deutschlands.",a:"größte",h:"superlative: am größten / die größte"},{q:"Deutsch ist ___ als Englisch.",a:"schwieriger",h:"comparative of schwierig"},{q:"Ich wasche ___ die Hände.",a:"mir",h:"dative reflexive: mir (for ich with body part)"},{q:"Er freut ___ auf den Urlaub.",a:"sich",h:"sich freuen auf — er/sie/es → sich"},{q:"Wir treffen ___ um sieben.",a:"uns",h:"sich treffen — wir → uns"},{q:"Ich arbeite ___ Montag bis Freitag.",a:"von",h:"von … bis = from … to"},{q:"___ Jahr 2024 war ich in Berlin.",a:"Im",h:"im = in dem (in the year)"},{q:"Das ist ___ Bruder (my).",a:"mein",h:"mein + masc. nom. = mein"},{q:"Ich sehe ___ Schwester (your, informal).",a:"deine",h:"dein + fem. acc. = deine"},{q:"Er kommt heute ___.",a:"nicht",h:"nicht at end for whole-sentence negation"},{q:"Ich habe ___ Geld.",a:"kein",h:"kein + neut. acc. = kein (no article negation)"},{q:"Ich arbeite ___ Montag.",a:"am",h:"am = an dem; days use 'am'"},{q:"Wir treffen uns ___ 8 Uhr.",a:"um",h:"um + clock times"},{q:"Die Schuhe stehen ___ dem Bett.",a:"vor",h:"vor + dative = location"},{q:"Ich trinke einen ___ Tee (cold).",a:"kalten",h:"einen + masc. acc. adj. → -en"},{q:"Ich rufe dich an, ___ ich zu Hause bin.",a:"wenn",h:"wenn = when/if (with present tense)"},{q:"Er geht ___ ins Büro (every day).",a:"jeden Tag",h:"time-manner-place: time before place"},{q:"Ich warte ___ den Bus.",a:"auf",h:"warten auf + accusative"}
];

// ── VERB DATA — UNCHANGED ──
const VERBS = [
  {v:"sein",en:"to be",pr:{ich:"bin",du:"bist",er:"ist",wir:"sind",ihr:"seid",sie:"sind"},pf:"ist gewesen",aux:"sein"},
  {v:"haben",en:"to have",pr:{ich:"habe",du:"hast",er:"hat",wir:"haben",ihr:"habt",sie:"haben"},pf:"hat gehabt",aux:"haben"},
  {v:"gehen",en:"to go",pr:{ich:"gehe",du:"gehst",er:"geht",wir:"gehen",ihr:"geht",sie:"gehen"},pf:"ist gegangen",aux:"sein"},
  {v:"kommen",en:"to come",pr:{ich:"komme",du:"kommst",er:"kommt",wir:"kommen",ihr:"kommt",sie:"kommen"},pf:"ist gekommen",aux:"sein"},
  {v:"machen",en:"to do/make",pr:{ich:"mache",du:"machst",er:"macht",wir:"machen",ihr:"macht",sie:"machen"},pf:"hat gemacht",aux:"haben"},
  {v:"sehen",en:"to see",pr:{ich:"sehe",du:"siehst",er:"sieht",wir:"sehen",ihr:"seht",sie:"sehen"},pf:"hat gesehen",aux:"haben"},
  {v:"essen",en:"to eat",pr:{ich:"esse",du:"isst",er:"isst",wir:"essen",ihr:"esst",sie:"essen"},pf:"hat gegessen",aux:"haben"},
  {v:"fahren",en:"to drive",pr:{ich:"fahre",du:"fährst",er:"fährt",wir:"fahren",ihr:"fahrt",sie:"fahren"},pf:"ist gefahren",aux:"sein"},
  {v:"sprechen",en:"to speak",pr:{ich:"spreche",du:"sprichst",er:"spricht",wir:"sprechen",ihr:"sprecht",sie:"sprechen"},pf:"hat gesprochen",aux:"haben"},
  {v:"geben",en:"to give",pr:{ich:"gebe",du:"gibst",er:"gibt",wir:"geben",ihr:"gebt",sie:"geben"},pf:"hat gegeben",aux:"haben"},
  {v:"nehmen",en:"to take",pr:{ich:"nehme",du:"nimmst",er:"nimmt",wir:"nehmen",ihr:"nehmt",sie:"nehmen"},pf:"hat genommen",aux:"haben"},
  {v:"lesen",en:"to read",pr:{ich:"lese",du:"liest",er:"liest",wir:"lesen",ihr:"lest",sie:"lesen"},pf:"hat gelesen",aux:"haben"},
  {v:"schlafen",en:"to sleep",pr:{ich:"schlafe",du:"schläfst",er:"schläft",wir:"schlafen",ihr:"schlaft",sie:"schlafen"},pf:"hat geschlafen",aux:"haben"},
  {v:"laufen",en:"to run",pr:{ich:"laufe",du:"läufst",er:"läuft",wir:"laufen",ihr:"lauft",sie:"laufen"},pf:"ist gelaufen",aux:"sein"},
  {v:"wissen",en:"to know",pr:{ich:"weiß",du:"weißt",er:"weiß",wir:"wissen",ihr:"wisst",sie:"wissen"},pf:"hat gewusst",aux:"haben"},
  {v:"können",en:"can",pr:{ich:"kann",du:"kannst",er:"kann",wir:"können",ihr:"könnt",sie:"können"},pf:"hat gekonnt",aux:"haben",modal:true},
  {v:"müssen",en:"must",pr:{ich:"muss",du:"musst",er:"muss",wir:"müssen",ihr:"müsst",sie:"müssen"},pf:"hat gemusst",aux:"haben",modal:true},
  {v:"wollen",en:"to want",pr:{ich:"will",du:"willst",er:"will",wir:"wollen",ihr:"wollt",sie:"wollen"},pf:"hat gewollt",aux:"haben",modal:true},
  {v:"sollen",en:"should",pr:{ich:"soll",du:"sollst",er:"soll",wir:"sollen",ihr:"sollt",sie:"sollen"},pf:"hat gesollt",aux:"haben",modal:true},
  {v:"dürfen",en:"may",pr:{ich:"darf",du:"darfst",er:"darf",wir:"dürfen",ihr:"dürft",sie:"dürfen"},pf:"hat gedurft",aux:"haben",modal:true},
  {v:"mögen",en:"to like",pr:{ich:"mag",du:"magst",er:"mag",wir:"mögen",ihr:"mögt",sie:"mögen"},pf:"hat gemocht",aux:"haben",modal:true},
  {v:"aufstehen",en:"to get up",pr:{ich:"stehe auf",du:"stehst auf",er:"steht auf",wir:"stehen auf",ihr:"steht auf",sie:"stehen auf"},pf:"ist aufgestanden",aux:"sein"},
  {v:"ankommen",en:"to arrive",pr:{ich:"komme an",du:"kommst an",er:"kommt an",wir:"kommen an",ihr:"kommt an",sie:"kommen an"},pf:"ist angekommen",aux:"sein"},
  {v:"anrufen",en:"to phone / call",pr:{ich:"rufe an",du:"rufst an",er:"ruft an",wir:"rufen an",ihr:"ruft an",sie:"rufen an"},pf:"hat angerufen",aux:"haben"},
  {v:"einkaufen",en:"to shop",pr:{ich:"kaufe ein",du:"kaufst ein",er:"kauft ein",wir:"kaufen ein",ihr:"kauft ein",sie:"kaufen ein"},pf:"hat eingekauft",aux:"haben"},
  {v:"mitkommen",en:"to come along",pr:{ich:"komme mit",du:"kommst mit",er:"kommt mit",wir:"kommen mit",ihr:"kommt mit",sie:"kommen mit"},pf:"ist mitgekommen",aux:"sein"},
  {v:"bleiben",en:"to stay",pr:{ich:"bleibe",du:"bleibst",er:"bleibt",wir:"bleiben",ihr:"bleibt",sie:"bleiben"},pf:"ist geblieben",aux:"sein"},
  {v:"werden",en:"to become",pr:{ich:"werde",du:"wirst",er:"wird",wir:"werden",ihr:"werdet",sie:"werden"},pf:"ist geworden",aux:"sein"},
  {v:"finden",en:"to find",pr:{ich:"finde",du:"findest",er:"findet",wir:"finden",ihr:"findet",sie:"finden"},pf:"hat gefunden",aux:"haben"},
  {v:"helfen",en:"to help",pr:{ich:"helfe",du:"hilfst",er:"hilft",wir:"helfen",ihr:"helft",sie:"helfen"},pf:"hat geholfen",aux:"haben"},
  {v:"sitzen",en:"to sit",pr:{ich:"sitze",du:"sitzt",er:"sitzt",wir:"sitzen",ihr:"sitzt",sie:"sitzen"},pf:"hat gesessen",aux:"haben"},
  {v:"schreiben",en:"to write",pr:{ich:"schreibe",du:"schreibst",er:"schreibt",wir:"schreiben",ihr:"schreibt",sie:"schreiben"},pf:"hat geschrieben",aux:"haben"},
  {v:"stehen",en:"to stand",pr:{ich:"stehe",du:"stehst",er:"steht",wir:"stehen",ihr:"steht",sie:"stehen"},pf:"hat gestanden",aux:"haben"},
  {v:"tragen",en:"to carry / wear",pr:{ich:"trage",du:"trägst",er:"trägt",wir:"tragen",ihr:"tragt",sie:"tragen"},pf:"hat getragen",aux:"haben"},
  {v:"treffen",en:"to meet",pr:{ich:"treffe",du:"triffst",er:"trifft",wir:"treffen",ihr:"trefft",sie:"treffen"},pf:"hat getroffen",aux:"haben"},
  {v:"vergessen",en:"to forget",pr:{ich:"vergesse",du:"vergisst",er:"vergisst",wir:"vergessen",ihr:"vergesst",sie:"vergessen"},pf:"hat vergessen",aux:"haben"},
  {v:"verstehen",en:"to understand",pr:{ich:"verstehe",du:"verstehst",er:"versteht",wir:"verstehen",ihr:"versteht",sie:"verstehen"},pf:"hat verstanden",aux:"haben"},
  {v:"warten",en:"to wait",pr:{ich:"warte",du:"wartest",er:"wartet",wir:"warten",ihr:"wartet",sie:"warten"},pf:"hat gewartet",aux:"haben"},
  {v:"ziehen",en:"to pull / move",pr:{ich:"ziehe",du:"ziehst",er:"zieht",wir:"ziehen",ihr:"zieht",sie:"ziehen"},pf:"hat gezogen",aux:"haben"},
  {v:"kaufen",en:"to buy",pr:{ich:"kaufe",du:"kaufst",er:"kauft",wir:"kaufen",ihr:"kauft",sie:"kaufen"},pf:"hat gekauft",aux:"haben"},
  {v:"brauchen",en:"to need",pr:{ich:"brauche",du:"brauchst",er:"braucht",wir:"brauchen",ihr:"braucht",sie:"brauchen"},pf:"hat gebraucht",aux:"haben"},
  {v:"hören",en:"to hear",pr:{ich:"höre",du:"hörst",er:"hört",wir:"hören",ihr:"hört",sie:"hören"},pf:"hat gehört",aux:"haben"},
  {v:"lernen",en:"to learn",pr:{ich:"lerne",du:"lernst",er:"lernt",wir:"lernen",ihr:"lernt",sie:"lernen"},pf:"hat gelernt",aux:"haben"},
  {v:"arbeiten",en:"to work",pr:{ich:"arbeite",du:"arbeitest",er:"arbeitet",wir:"arbeiten",ihr:"arbeitet",sie:"arbeiten"},pf:"hat gearbeitet",aux:"haben"},
  {v:"wohnen",en:"to live / reside",pr:{ich:"wohne",du:"wohnst",er:"wohnt",wir:"wohnen",ihr:"wohnt",sie:"wohnen"},pf:"hat gewohnt",aux:"haben"},
  {v:"spielen",en:"to play",pr:{ich:"spiele",du:"spielst",er:"spielt",wir:"spielen",ihr:"spielt",sie:"spielen"},pf:"hat gespielt",aux:"haben"},
  {v:"trinken",en:"to drink",pr:{ich:"trinke",du:"trinkst",er:"trinkt",wir:"trinken",ihr:"trinkt",sie:"trinken"},pf:"hat getrunken",aux:"haben"},
  {v:"kochen",en:"to cook",pr:{ich:"koche",du:"kochst",er:"kocht",wir:"kochen",ihr:"kocht",sie:"kochen"},pf:"hat gekocht",aux:"haben"},
  {v:"lieben",en:"to love",pr:{ich:"liebe",du:"liebst",er:"liebt",wir:"lieben",ihr:"liebt",sie:"lieben"},pf:"hat geliebt",aux:"haben"},
  {v:"bekommen",en:"to get/receive",pr:{ich:"bekomme",du:"bekommst",er:"bekommt",wir:"bekommen",ihr:"bekommt",sie:"bekommen"},pf:"hat bekommen",aux:"haben"},
  {v:"bestellen",en:"to order",pr:{ich:"bestelle",du:"bestellst",er:"bestellt",wir:"bestellen",ihr:"bestellt",sie:"bestellen"},pf:"hat bestellt",aux:"haben"},
  {v:"bezahlen",en:"to pay",pr:{ich:"bezahle",du:"bezahlst",er:"bezahlt",wir:"bezahlen",ihr:"bezahlt",sie:"bezahlen"},pf:"hat bezahlt",aux:"haben"},
  {v:"denken",en:"to think",pr:{ich:"denke",du:"denkst",er:"denkt",wir:"denken",ihr:"denkt",sie:"denken"},pf:"hat gedacht",aux:"haben"},
  {v:"fragen",en:"to ask",pr:{ich:"frage",du:"fragst",er:"fragt",wir:"fragen",ihr:"fragt",sie:"fragen"},pf:"hat gefragt",aux:"haben"},
  {v:"antworten",en:"to answer",pr:{ich:"antworte",du:"antwortest",er:"antwortet",wir:"antworten",ihr:"antwortet",sie:"antworten"},pf:"hat geantwortet",aux:"haben"},
  {v:"öffnen",en:"to open",pr:{ich:"öffne",du:"öffnest",er:"öffnet",wir:"öffnen",ihr:"öffnet",sie:"öffnen"},pf:"hat geöffnet",aux:"haben"},
  {v:"schließen",en:"to close",pr:{ich:"schließe",du:"schließt",er:"schließt",wir:"schließen",ihr:"schließt",sie:"schließen"},pf:"hat geschlossen",aux:"haben"},
  {v:"benutzen",en:"to use",pr:{ich:"benutze",du:"benutzt",er:"benutzt",wir:"benutzen",ihr:"benutzt",sie:"benutzen"},pf:"hat benutzt",aux:"haben"},
  {v:"zeigen",en:"to show",pr:{ich:"zeige",du:"zeigst",er:"zeigt",wir:"zeigen",ihr:"zeigt",sie:"zeigen"},pf:"hat gezeigt",aux:"haben"},
  {v:"bringen",en:"to bring",pr:{ich:"bringe",du:"bringst",er:"bringt",wir:"bringen",ihr:"bringt",sie:"bringen"},pf:"hat gebracht",aux:"haben"}
];

// ── SENTENCE DATA — UNCHANGED ──
const SENTENCES = [
  {correct:["Ich","gehe","morgen","ins","Kino"],en:"I'm going to the cinema tomorrow",rule:"V2: verb in 2nd position"},
  {correct:["Morgen","gehe","ich","ins","Kino"],en:"Tomorrow I'm going to the cinema",rule:"V2: time adverb first → verb stays 2nd, subject moves"},
  {correct:["Er","hat","gestern","viel","gelernt"],en:"He learned a lot yesterday",rule:"Perfekt: auxiliary 2nd, participle at end"},
  {correct:["Ich","lerne","Deutsch",",","weil","ich","nach","Berlin","fahre"],en:"I learn German because I'm going to Berlin",rule:"weil → subordinate clause, verb to end"},
  {correct:["Obwohl","es","regnet",",","gehen","wir","spazieren"],en:"Although it's raining, we go for a walk",rule:"obwohl → verb to end in sub-clause, main clause V2"},
  {correct:["Ich","muss","morgen","früh","aufstehen"],en:"I have to get up early tomorrow",rule:"Modal verb 2nd, infinitive at end"},
  {correct:["Kannst","du","mir","bitte","helfen","?"],en:"Can you please help me?",rule:"Question: modal verb 1st, infinitive at end"},
  {correct:["Er","ist","gestern","nach","Hause","gegangen"],en:"He went home yesterday",rule:"Perfekt with sein: ist … gegangen"},
  {correct:["Ich","denke",",","dass","er","morgen","kommt"],en:"I think that he's coming tomorrow",rule:"dass → verb to end of sub-clause"},
  {correct:["Wenn","ich","Zeit","habe",",","gehe","ich","ins","Kino"],en:"When I have time, I go to the cinema",rule:"wenn → verb to end, then main clause V2"},
  {correct:["Sie","hat","mir","ein","Buch","gegeben"],en:"She gave me a book",rule:"Perfekt: hat … gegeben, dative before accusative"},
  {correct:["Ich","will","nächste","Woche","nach","Berlin","fahren"],en:"I want to go to Berlin next week",rule:"Modal: will 2nd, infinitive at end"},
  {correct:["Er","kann","sehr","gut","Deutsch","sprechen"],en:"He can speak German very well",rule:"Modal: kann 2nd, infinitive at end"},
  {correct:["Ich","bin","seit","drei","Jahren","in","Wales"],en:"I've been in Wales for three years",rule:"seit + present tense (not Perfekt)"},
  {correct:["Gestern","bin","ich","um","sechs","aufgestanden"],en:"Yesterday I got up at six",rule:"V2: time first, bin 2nd, participle at end"},
  {correct:["Nachdem","ich","gegessen","hatte",",","ging","ich","spazieren"],en:"After I had eaten, I went for a walk",rule:"nachdem + Plusquamperfekt, main clause Präteritum"},
  {correct:["Ich","habe","keine","Lust",",","heute","zu","arbeiten"],en:"I don't feel like working today",rule:"zu + infinitive at end"},
  {correct:["Er","fährt","jeden","Tag","mit","dem","Bus"],en:"He takes the bus every day",rule:"mit + dative (dem Bus)"},
  {correct:["Das","Buch",",","das","ich","lese",",","ist","interessant"],en:"The book that I'm reading is interesting",rule:"Relative clause: verb to end"},
  {correct:["Ich","würde","gern","nach","Japan","reisen"],en:"I would like to travel to Japan",rule:"Konjunktiv II: würde + infinitive at end"},
  {correct:["Heute","Abend","gehen","wir","ins","Konzert"],en:"Tonight we are going to the concert",rule:"V2: time first, verb 2nd"},
  {correct:["Ich","habe","meinen","Schlüssel","verloren"],en:"I have lost my key",rule:"Perfekt: habe … verloren"},
  {correct:["Bevor","ich","schlafe",",","lese","ich","ein","Buch"],en:"Before I sleep, I read a book",rule:"bevor → verb to end, main clause V2"},
  {correct:["Ich","weiß","nicht",",","wo","er","wohnt"],en:"I don't know where he lives",rule:"indirect question: verb to end"},
  {correct:["Die","Kinder",",","die","im","Garten","spielen",",","sind","laut"],en:"The children who are playing in the garden are loud",rule:"relative clause: verb to end"},
  {correct:["Er","sagt",",","dass","er","krank","sei"],en:"He says that he is sick",rule:"Konjunktiv I (reported speech)"},
  {correct:["Wenn","ich","Zeit","hätte",",","würde","ich","reisen"],en:"If I had time, I would travel",rule:"Konjunktiv II: hätte + würde"},
  {correct:["Das","Auto","wird","repariert"],en:"The car is being repaired",rule:"Passiv: wird + Partizip II"},
  {correct:["Das","Haus","wurde","gebaut"],en:"The house was built",rule:"Passiv Präteritum: wurde + Partizip II"},
  {correct:["Ich","habe","ihn","noch","nie","gesehen"],en:"I have never seen him before",rule:"noch nie = never before; Perfekt"},
  {correct:["Es","gibt","keinen","Grund",",","traurig","zu","sein"],en:"There is no reason to be sad",rule:"es gibt + accusative; zu + infinitive"},
  {correct:["Er","ist","so","müde",",","dass","er","nicht","arbeiten","kann"],en:"He is so tired that he can't work",rule:"so … dass = so … that"},
  {correct:["Je","mehr","ich","lerne",",","desto","besser","wird","mein","Deutsch"],en:"The more I learn, the better my German gets",rule:"je … desto = the … the"},
  {correct:["Ich","hoffe",",","dass","du","bald","kommst"],en:"I hope that you come soon",rule:"dass + verb to end"},
  {correct:["Statt","zu","arbeiten",",","schaut","er","fern"],en:"Instead of working, he watches TV",rule:"statt zu + infinitive"},
  {correct:["Um","Deutsch","zu","lernen",",","brauchst","du","Zeit"],en:"To learn German, you need time",rule:"um … zu + infinitive = in order to"},
  {correct:["Ohne","zu","fragen",",","nahm","er","mein","Auto"],en:"Without asking, he took my car",rule:"ohne zu + infinitive"},
  {correct:["Ich","freue","mich",",","dich","zu","sehen"],en:"I'm happy to see you",rule:"sich freuen + zu + infinitive"},
  {correct:["Das","ist","der","Mann",",","dem","ich","geholfen","habe"],en:"That is the man whom I helped",rule:"relative pronoun dative (dem)"},
  {correct:["Wir","treffen","uns","am","Bahnhof"],en:"We'll meet at the train station",rule:"reflexive: sich treffen; am = an+dem"},
  {correct:["Der","Zug","fährt","um","zehn","Uhr","ab"],en:"The train departs at ten o'clock",rule:"separable verb: abfahren"},
  {correct:["Ich","habe","Lust",",","ins","Kino","zu","gehen"],en:"I feel like going to the cinema",rule:"Lust haben + zu + infinitive"},
  {correct:["Er","hat","keine","Zeit",",","mit","uns","zu","essen"],en:"He has no time to eat with us",rule:"keine Zeit + zu + infinitive"},
  {correct:["Ich","bin","in","Wales","geboren"],en:"I was born in Wales",rule:"geboren: passive-like, always with sein"},
  {correct:["Darf","ich","dich","etwas","fragen","?"],en:"May I ask you something?",rule:"modal question: dürfen ich-form"},
  {correct:["Ich","würde","gern","mit","dir","reden"],en:"I would like to talk with you",rule:"würde + infinitive = polite wish"},
  {correct:["Mir","ist","kalt"],en:"I'm cold",rule:"dative construction: mir ist …"},
  {correct:["Es","tut","mir","leid"],en:"I'm sorry",rule:"fixed expression: es tut mir leid"},
  {correct:["Können","Sie","mir","helfen","?"],en:"Can you help me? (formal)",rule:"Sie + modal question; helfen + dative (mir)"},
  {correct:["Ich","habe","mich","mit","ihr","gestritten"],en:"I argued with her",rule:"reflexive Perfekt: sich streiten"},
  {correct:["Wir","essen","heute","Pizza"],en:"We're eating pizza today",rule:"V2: verb in 2nd position"},
  {correct:["Am","Wochenende","fahre","ich","nach","Hause"],en:"On the weekend I'm going home",rule:"V2: time phrase first → subject after verb"},
  {correct:["Ich","habe","meinen","Schlüssel","verloren"],en:"I've lost my key",rule:"Perfekt: auxiliary 2nd, participle at end"},
  {correct:["Sie","ist","in","Berlin","angekommen"],en:"She has arrived in Berlin",rule:"Perfekt with sein: ist + ankommen"},
  {correct:["Wir","sind","gestern","ins","Kino","gegangen"],en:"We went to the cinema yesterday",rule:"Perfekt with sein: sind + gegangen"},
  {correct:["Ich","möchte","einen","Kaffee","bestellen"],en:"I'd like to order a coffee",rule:"Modal: möchte 2nd, infinitive at end"},
  {correct:["Er","darf","heute","nicht","arbeiten"],en:"He's not allowed to work today",rule:"Modal + negation: nicht before infinitive"},
  {correct:["Wir","sollen","pünktlich","sein"],en:"We should be on time",rule:"Modal + infinitive at end"},
  {correct:["Wo","wohnst","du","?"],en:"Where do you live?",rule:"W-question: verb 2nd"},
  {correct:["Wann","kommt","der","Zug","?"],en:"When does the train come?",rule:"W-question with definite article"},
  {correct:["Hast","du","meinen","Bruder","gesehen","?"],en:"Have you seen my brother?",rule:"Yes/no Perfekt question: aux 1st, participle at end"},
  {correct:["Warum","bist","du","so","traurig","?"],en:"Why are you so sad?",rule:"W-question with adjective"},
  {correct:["Ich","frage","mich",",","ob","er","kommt"],en:"I wonder whether he is coming",rule:"ob-clause (indirect question): verb to end"},
  {correct:["Sie","sagt",",","dass","sie","müde","ist"],en:"She says that she is tired",rule:"dass: verb to end of sub-clause"},
  {correct:["Wenn","ich","Geld","habe",",","kaufe","ich","ein","Auto"],en:"If I have money, I'll buy a car",rule:"wenn-clause: verb at end, main clause V2"},
  {correct:["Er","kann","kommen",",","weil","er","Zeit","hat"],en:"He can come because he has time",rule:"weil: verb to end"},
  {correct:["Ich","bleibe","zu","Hause",",","weil","es","regnet"],en:"I'm staying home because it's raining",rule:"weil: verb to end"},
  {correct:["Ich","hoffe",",","dass","du","kommst"],en:"I hope that you're coming",rule:"dass: verb to end"},
  {correct:["Mach","bitte","die","Tür","zu","!"],en:"Please close the door!",rule:"du-imperative with separable verb: prefix at end"},
  {correct:["Nimm","einen","Regenschirm","mit","!"],en:"Take an umbrella with you!",rule:"du-imperative: mitnehmen → nimm + mit"}
];

// ── NEW: MINI DIALOGUE DATA ──
const DIALOGUES = [
  {title:"At the café",lines:[{de:"Guten Tag! Was darf es sein?",en:"Good day! What can I get you?"},{de:"Einen Kaffee, bitte.",en:"A coffee, please."},{de:"Mit Milch und Zucker?",en:"With milk and sugar?"},{de:"Nur Milch, bitte. Was kostet das?",en:"Just milk, please. How much is that?"},{de:"Zwei Euro fünfzig.",en:"Two euros fifty."}]},
  {title:"Asking for directions",lines:[{de:"Entschuldigung, wo ist der Bahnhof?",en:"Excuse me, where is the train station?"},{de:"Gehen Sie geradeaus und dann links.",en:"Go straight ahead and then left."},{de:"Ist es weit von hier?",en:"Is it far from here?"},{de:"Nein, ungefähr fünf Minuten zu Fuß.",en:"No, about five minutes on foot."}]},
  {title:"At the supermarket",lines:[{de:"Haben Sie Vollkornbrot?",en:"Do you have wholemeal bread?"},{de:"Ja, im dritten Gang links.",en:"Yes, in the third aisle on the left."},{de:"Danke. Und wo finde ich die Milch?",en:"Thanks. And where can I find the milk?"},{de:"Ganz hinten im Kühlregal.",en:"Right at the back in the fridge section."}]},
  {title:"Meeting someone",lines:[{de:"Hallo! Ich bin Anna. Und du?",en:"Hello! I'm Anna. And you?"},{de:"Hi, ich heiße Jack. Woher kommst du?",en:"Hi, my name is Jack. Where are you from?"},{de:"Ich komme aus Berlin. Und du?",en:"I'm from Berlin. And you?"},{de:"Ich komme aus Wales.",en:"I'm from Wales."},{de:"Oh cool! Was machst du in Deutschland?",en:"Oh cool! What are you doing in Germany?"}]},
  {title:"Booking a hotel",lines:[{de:"Guten Tag. Ich möchte ein Zimmer buchen.",en:"Good day. I'd like to book a room."},{de:"Für wie viele Nächte?",en:"For how many nights?"},{de:"Drei Nächte, bitte. Was kostet das pro Nacht?",en:"Three nights, please. How much per night?"},{de:"Achtzig Euro mit Frühstück.",en:"Eighty euros with breakfast."}]},
  {title:"At the doctor",lines:[{de:"Was fehlt Ihnen?",en:"What's wrong with you?"},{de:"Ich habe Kopfschmerzen und Fieber.",en:"I have a headache and a fever."},{de:"Seit wann haben Sie die Beschwerden?",en:"How long have you had the symptoms?"},{de:"Seit gestern Abend.",en:"Since yesterday evening."},{de:"Ich schreibe Ihnen ein Rezept.",en:"I'll write you a prescription."}]},
  {title:"On the phone",lines:[{de:"Hallo, hier ist Jack. Ist Anna da?",en:"Hello, this is Jack. Is Anna there?"},{de:"Einen Moment bitte, ich verbinde Sie.",en:"One moment please, I'll put you through."},{de:"Danke!",en:"Thanks!"},{de:"Hallo Jack! Schön, dass du anrufst.",en:"Hello Jack! Nice that you're calling."}]},
  {title:"At the restaurant",lines:[{de:"Einen Tisch für zwei, bitte.",en:"A table for two, please."},{de:"Gerne. Hier ist die Speisekarte.",en:"Of course. Here is the menu."},{de:"Was können Sie empfehlen?",en:"What can you recommend?"},{de:"Der Fisch ist heute besonders gut.",en:"The fish is especially good today."},{de:"Dann nehme ich den Fisch.",en:"Then I'll have the fish."}]},
  {title:"Weekend plans",lines:[{de:"Was machst du am Wochenende?",en:"What are you doing at the weekend?"},{de:"Ich gehe wandern, wenn das Wetter gut ist.",en:"I'm going hiking if the weather is good."},{de:"Das klingt toll! Darf ich mitkommen?",en:"That sounds great! Can I come along?"},{de:"Natürlich! Wir treffen uns um neun.",en:"Of course! We'll meet at nine."}]},
  {title:"At the train station",lines:[{de:"Eine Fahrkarte nach Berlin, bitte.",en:"A ticket to Berlin, please."},{de:"Einfach oder hin und zurück?",en:"Single or return?"},{de:"Hin und zurück, bitte. Muss ich umsteigen?",en:"Return, please. Do I have to change?"},{de:"Ja, in Frankfurt. Gleis sieben.",en:"Yes, in Frankfurt. Platform seven."}]},
  {title:"Small talk at work",lines:[{de:"Morgen! Wie war dein Wochenende?",en:"Morning! How was your weekend?"},{de:"Ganz gut, danke. Ich war beim Bouldern.",en:"Pretty good, thanks. I was bouldering."},{de:"Oh, das mache ich auch gern!",en:"Oh, I like doing that too!"},{de:"Wir sollten mal zusammen gehen.",en:"We should go together sometime."}]},
  {title:"Renting a flat",lines:[{de:"Ich suche eine Wohnung mit zwei Zimmern.",en:"I'm looking for a flat with two rooms."},{de:"Wie hoch darf die Miete sein?",en:"How high can the rent be?"},{de:"Maximal achthundert Euro warm.",en:"Maximum eight hundred euros including bills."},{de:"Ich habe etwas in der Stadtmitte.",en:"I have something in the city centre."}]},
  {title:"At the pharmacy",lines:[{de:"Guten Tag. Ich brauche etwas gegen Kopfschmerzen.",en:"Good day. I need something for a headache."},{de:"Haben Sie ein Rezept?",en:"Do you have a prescription?"},{de:"Nein, ich brauche etwas ohne Rezept.",en:"No, I need something without a prescription."},{de:"Dann nehmen Sie diese Tabletten hier.",en:"Then take these tablets here."},{de:"Wie oft soll ich sie einnehmen?",en:"How often should I take them?"},{de:"Zweimal täglich, nach dem Essen.",en:"Twice a day, after meals."}]},
  {title:"Job interview basics",lines:[{de:"Erzählen Sie mir bitte kurz über sich.",en:"Please tell me briefly about yourself."},{de:"Ich bin Jack, und ich arbeite als Ingenieur.",en:"I'm Jack, and I work as an engineer."},{de:"Warum möchten Sie bei uns arbeiten?",en:"Why would you like to work with us?"},{de:"Ich schätze Ihre Firma und suche eine neue Herausforderung.",en:"I value your company and am looking for a new challenge."},{de:"Welche Stärken haben Sie?",en:"What are your strengths?"},{de:"Ich bin zuverlässig und arbeite gut im Team.",en:"I'm reliable and work well in a team."}]},
  {title:"At the post office",lines:[{de:"Ich möchte dieses Paket nach England schicken.",en:"I'd like to send this parcel to England."},{de:"Normal oder als Expresspaket?",en:"Standard or express?"},{de:"Normal, bitte. Wie lange dauert das?",en:"Standard, please. How long does it take?"},{de:"Ungefähr eine Woche.",en:"About a week."},{de:"Gut. Und eine Briefmarke für diesen Brief.",en:"Good. And a stamp for this letter."}]},
  {title:"Reporting an issue to a landlord",lines:[{de:"Guten Tag, die Heizung in meiner Wohnung funktioniert nicht.",en:"Good day, the heating in my flat isn't working."},{de:"Seit wann haben Sie das Problem?",en:"Since when have you had the problem?"},{de:"Seit gestern Abend. Es ist sehr kalt geworden.",en:"Since yesterday evening. It's gotten very cold."},{de:"Ich schicke morgen einen Techniker vorbei.",en:"I'll send a technician by tomorrow."},{de:"Vielen Dank, das wäre super.",en:"Thank you, that would be great."}]},
  {title:"Ordering online delivery",lines:[{de:"Hallo, ich habe online bestellt, aber nichts ist angekommen.",en:"Hello, I ordered online but nothing has arrived."},{de:"Haben Sie eine Bestellnummer?",en:"Do you have an order number?"},{de:"Ja, die Nummer ist 47583.",en:"Yes, the number is 47583."},{de:"Einen Moment, ich prüfe das für Sie.",en:"One moment, I'll check that for you."},{de:"Das Paket kommt morgen zwischen neun und zwölf.",en:"The parcel will arrive tomorrow between nine and twelve."}]},
  {title:"Small talk about weekend",lines:[{de:"Wie war dein Wochenende?",en:"How was your weekend?"},{de:"Ganz gut, danke. Ich war wandern im Wald.",en:"Pretty good, thanks. I was hiking in the forest."},{de:"Klingt schön! Mit wem?",en:"Sounds nice! With who?"},{de:"Mit ein paar Freunden aus dem Fitnessstudio.",en:"With a few friends from the gym."},{de:"Und das Wetter?",en:"And the weather?"},{de:"Es hat geregnet, aber wir hatten trotzdem viel Spaß.",en:"It rained, but we still had a lot of fun."}]},
  {title:"Buying a SIM card",lines:[{de:"Ich möchte eine Prepaid-SIM-Karte kaufen.",en:"I'd like to buy a prepaid SIM card."},{de:"Welche Anbieter kennen Sie?",en:"Which providers do you know?"},{de:"Ist dieser Tarif für Telefonieren und Internet?",en:"Is this plan for calls and internet?"},{de:"Ja, Sie bekommen 10 GB Daten und eine Flatrate.",en:"Yes, you get 10 GB of data and a flat rate."},{de:"Was kostet das pro Monat?",en:"How much per month?"},{de:"Fünfzehn Euro.",en:"Fifteen euros."}]},
  {title:"Registering at the Bürgeramt",lines:[{de:"Ich möchte mich anmelden.",en:"I'd like to register."},{de:"Haben Sie einen Termin?",en:"Do you have an appointment?"},{de:"Ja, um elf Uhr. Mein Name ist Jack Williams.",en:"Yes, at eleven o'clock. My name is Jack Williams."},{de:"Bitte zeigen Sie Ihren Pass und den Mietvertrag.",en:"Please show your passport and rental contract."},{de:"Hier, bitte schön.",en:"Here you go."}]},
  {title:"Joining a gym",lines:[{de:"Ich interessiere mich für eine Mitgliedschaft.",en:"I'm interested in a membership."},{de:"Möchten Sie das Monats- oder Jahresabo?",en:"Would you like the monthly or yearly subscription?"},{de:"Was kostet das Jahresabo?",en:"How much is the yearly subscription?"},{de:"300 Euro, und die erste Woche ist kostenlos.",en:"300 euros, and the first week is free."},{de:"Kann ich zuerst eine Probestunde machen?",en:"Can I do a trial session first?"}]},
  {title:"Texting a friend to meet",lines:[{de:"Hey, hast du heute Abend Zeit?",en:"Hey, do you have time this evening?"},{de:"Ja, was machen wir?",en:"Yeah, what are we doing?"},{de:"Lass uns ins Kino gehen. Es läuft ein guter Film.",en:"Let's go to the cinema. There's a good film on."},{de:"Klingt super! Um wie viel Uhr?",en:"Sounds great! At what time?"},{de:"Um acht vor dem Kino?",en:"Eight in front of the cinema?"},{de:"Perfekt, bis dann!",en:"Perfect, see you then!"}]},
  {title:"Complaining politely at a restaurant",lines:[{de:"Entschuldigung, die Suppe ist kalt.",en:"Excuse me, the soup is cold."},{de:"Oh, das tut mir leid. Ich bringe eine neue.",en:"Oh, I'm sorry. I'll bring a new one."},{de:"Danke. Und das Brot fehlt auch noch.",en:"Thanks. And the bread is still missing too."},{de:"Entschuldigen Sie die Verspätung. Es kommt gleich.",en:"Please excuse the delay. It's coming right away."}]},
  {title:"Asking about work hours",lines:[{de:"Wann hast du normalerweise Feierabend?",en:"When do you usually finish work?"},{de:"Meistens um 17 Uhr, manchmal später.",en:"Usually at 5pm, sometimes later."},{de:"Und am Wochenende?",en:"And on the weekend?"},{de:"Am Wochenende arbeite ich nicht.",en:"I don't work on the weekend."}]},
  {title:"At the airport check-in",lines:[{de:"Guten Tag, ich möchte einchecken.",en:"Good day, I'd like to check in."},{de:"Ihren Pass bitte. Haben Sie Gepäck?",en:"Your passport please. Do you have luggage?"},{de:"Ja, einen Koffer.",en:"Yes, one suitcase."},{de:"Bitte stellen Sie ihn aufs Band. Hier ist Ihre Bordkarte.",en:"Please put it on the belt. Here's your boarding pass."},{de:"Welches Gate?",en:"Which gate?"},{de:"Gate zwölf, das Boarding beginnt um neun.",en:"Gate twelve, boarding starts at nine."}]},
  {title:"Im Café bestellen",lines:[{speaker:"Kellner",de:"Guten Tag, was möchten Sie?",en:"Hello, what would you like?"},{speaker:"Kunde",de:"Einen Cappuccino und ein Stück Apfelkuchen, bitte.",en:"A cappuccino and a slice of apple cake, please."},{speaker:"Kellner",de:"Möchten Sie den Kuchen mit Sahne?",en:"Would you like the cake with cream?"},{speaker:"Kunde",de:"Ja, gerne. Was macht das zusammen?",en:"Yes, please. How much is that altogether?"},{speaker:"Kellner",de:"Sieben Euro vierzig.",en:"Seven euros forty."}],questions:[{q:"Was bestellt der Kunde zu trinken?",opts:["Einen Kaffee","Einen Cappuccino","Einen Tee"],correctIdx:1},{q:"Möchte der Kunde Sahne auf dem Kuchen?",opts:["Ja","Nein","Nur Zucker"],correctIdx:0}]},
  {title:"Bezahlen im Restaurant",lines:[{speaker:"Kunde",de:"Die Rechnung, bitte!",en:"The bill, please!"},{speaker:"Kellner",de:"Zusammen oder getrennt?",en:"Together or separately?"},{speaker:"Kunde",de:"Zusammen, bitte.",en:"Together, please."},{speaker:"Kellner",de:"Das macht 32 Euro 50.",en:"That's 32 euros 50."},{speaker:"Kunde",de:"Hier sind 35. Stimmt so.",en:"Here's 35. Keep the change."},{speaker:"Kellner",de:"Vielen Dank, schönen Abend!",en:"Thank you, have a nice evening!"}],questions:[{q:"Wie viel kostet das Essen?",opts:["32,50 €","35,00 €","25,50 €"],correctIdx:0},{q:"Wie zahlen die Gäste?",opts:["Getrennt","Zusammen","Mit Karte"],correctIdx:1}]},
  {title:"Beim Bäcker",lines:[{speaker:"Kunde",de:"Guten Morgen! Zwei Brötchen und ein Vollkornbrot, bitte.",en:"Good morning! Two rolls and a wholemeal bread, please."},{speaker:"Verkäuferin",de:"Sonst noch etwas?",en:"Anything else?"},{speaker:"Kunde",de:"Ja, ein Croissant mit Schokolade.",en:"Yes, a chocolate croissant."},{speaker:"Verkäuferin",de:"Das macht vier Euro achtzig.",en:"That's four euros eighty."},{speaker:"Kunde",de:"Bitte schön. Danke!",en:"Here you go. Thanks!"}],questions:[{q:"Wie viele Brötchen kauft der Kunde?",opts:["Eins","Zwei","Drei"],correctIdx:1},{q:"Was kauft er noch außer Brot?",opts:["Einen Kuchen","Ein Croissant","Nichts"],correctIdx:1}]},
  {title:"In der Apotheke",lines:[{speaker:"Kunde",de:"Ich habe Halsschmerzen. Was können Sie mir empfehlen?",en:"I have a sore throat. What can you recommend?"},{speaker:"Apotheker",de:"Diese Lutschtabletten helfen gut.",en:"These lozenges help well."},{speaker:"Kunde",de:"Brauche ich ein Rezept?",en:"Do I need a prescription?"},{speaker:"Apotheker",de:"Nein, die bekommen Sie rezeptfrei.",en:"No, they're available over the counter."},{speaker:"Kunde",de:"Gut, die nehme ich. Was kosten sie?",en:"Good, I'll take them. How much are they?"},{speaker:"Apotheker",de:"Sechs Euro neunzig.",en:"Six euros ninety."}],questions:[{q:"Was hat der Kunde?",opts:["Kopfschmerzen","Halsschmerzen","Bauchschmerzen"],correctIdx:1},{q:"Braucht er ein Rezept?",opts:["Ja","Nein","Vielleicht"],correctIdx:1}]},
  {title:"Beim Arzt — Termin machen",lines:[{speaker:"Patient",de:"Guten Tag, ich hätte gern einen Termin.",en:"Hello, I'd like an appointment."},{speaker:"Sprechstundenhilfe",de:"Waren Sie schon einmal bei uns?",en:"Have you been with us before?"},{speaker:"Patient",de:"Nein, ich bin neu hier.",en:"No, I'm new here."},{speaker:"Sprechstundenhilfe",de:"Geht es am Donnerstag um 10 Uhr?",en:"Does Thursday at 10am work?"},{speaker:"Patient",de:"Ja, das passt mir. Danke!",en:"Yes, that suits me. Thanks!"}],questions:[{q:"War der Patient schon einmal dort?",opts:["Ja","Nein","Letztes Jahr"],correctIdx:1},{q:"Wann ist der Termin?",opts:["Mittwoch","Donnerstag","Freitag"],correctIdx:1}]},
  {title:"An der Supermarktkasse",lines:[{speaker:"Kassiererin",de:"Haben Sie eine Kundenkarte?",en:"Do you have a loyalty card?"},{speaker:"Kunde",de:"Nein, habe ich nicht.",en:"No, I don't."},{speaker:"Kassiererin",de:"Das macht 23 Euro 80.",en:"That's 23 euros 80."},{speaker:"Kunde",de:"Kann ich mit Karte zahlen?",en:"Can I pay by card?"},{speaker:"Kassiererin",de:"Ja, natürlich. Stecken Sie bitte die Karte ein.",en:"Yes, of course. Please insert the card."},{speaker:"Kunde",de:"Brauche ich eine Quittung?",en:"Do I need a receipt?"},{speaker:"Kassiererin",de:"Wie Sie möchten.",en:"As you wish."}],questions:[{q:"Hat der Kunde eine Kundenkarte?",opts:["Ja","Nein","Er sucht sie"],correctIdx:1},{q:"Wie zahlt der Kunde?",opts:["Bar","Mit Karte","Mit Handy"],correctIdx:1}]},
  {title:"Am Bahnhof — Ticket kaufen",lines:[{speaker:"Reisender",de:"Eine Fahrkarte nach Hamburg, bitte.",en:"A ticket to Hamburg, please."},{speaker:"Schalterbeamter",de:"Einfach oder hin und zurück?",en:"Single or return?"},{speaker:"Reisender",de:"Hin und zurück. Zweite Klasse.",en:"Return. Second class."},{speaker:"Schalterbeamter",de:"Wann möchten Sie zurückfahren?",en:"When would you like to come back?"},{speaker:"Reisender",de:"Sonntag Abend.",en:"Sunday evening."},{speaker:"Schalterbeamter",de:"Das macht 89 Euro.",en:"That's 89 euros."}],questions:[{q:"Wohin fährt der Reisende?",opts:["München","Hamburg","Berlin"],correctIdx:1},{q:"Welche Art Ticket kauft er?",opts:["Einfach","Hin und zurück","Monatskarte"],correctIdx:1}]},
  {title:"Zug — Verspätung",lines:[{speaker:"Reisender",de:"Entschuldigung, hat der Zug nach Köln Verspätung?",en:"Excuse me, is the Cologne train delayed?"},{speaker:"Bahnangestellter",de:"Ja, leider zwanzig Minuten.",en:"Yes, unfortunately twenty minutes."},{speaker:"Reisender",de:"Und von welchem Gleis fährt er ab?",en:"And from which platform does it leave?"},{speaker:"Bahnangestellter",de:"Gleis sieben, heute ausnahmsweise.",en:"Platform seven, exceptionally today."},{speaker:"Reisender",de:"Danke für die Information.",en:"Thanks for the information."}],questions:[{q:"Wie viel Verspätung hat der Zug?",opts:["10 Minuten","20 Minuten","30 Minuten"],correctIdx:1},{q:"Von welchem Gleis fährt er ab?",opts:["Gleis 5","Gleis 7","Gleis 9"],correctIdx:1}]},
  {title:"Im Hotel einchecken",lines:[{speaker:"Gast",de:"Guten Abend, ich habe ein Zimmer reserviert. Mein Name ist Williams.",en:"Good evening, I've reserved a room. My name is Williams."},{speaker:"Rezeptionist",de:"Willkommen! Ein Doppelzimmer für zwei Nächte, richtig?",en:"Welcome! A double room for two nights, correct?"},{speaker:"Gast",de:"Genau. Gibt es WLAN im Zimmer?",en:"Exactly. Is there wifi in the room?"},{speaker:"Rezeptionist",de:"Ja, das Passwort finden Sie auf diesem Zettel.",en:"Yes, you'll find the password on this slip."},{speaker:"Gast",de:"Um wie viel Uhr gibt es Frühstück?",en:"What time is breakfast?"},{speaker:"Rezeptionist",de:"Von sieben bis zehn Uhr.",en:"From seven to ten."}],questions:[{q:"Wie lange bleibt der Gast?",opts:["Eine Nacht","Zwei Nächte","Drei Nächte"],correctIdx:1},{q:"Wann gibt es Frühstück?",opts:["6–9 Uhr","7–10 Uhr","8–11 Uhr"],correctIdx:1}]},
  {title:"Nach dem Weg fragen",lines:[{speaker:"Tourist",de:"Entschuldigung, wie komme ich zum Museum?",en:"Excuse me, how do I get to the museum?"},{speaker:"Passant",de:"Gehen Sie hier geradeaus, dann die zweite Straße rechts.",en:"Go straight here, then second street on the right."},{speaker:"Tourist",de:"Wie weit ist es?",en:"How far is it?"},{speaker:"Passant",de:"Ungefähr zehn Minuten zu Fuß.",en:"About ten minutes on foot."},{speaker:"Tourist",de:"Vielen Dank!",en:"Thank you very much!"}],questions:[{q:"Was sucht der Tourist?",opts:["Den Bahnhof","Das Museum","Das Hotel"],correctIdx:1},{q:"Wie weit ist es zu Fuß?",opts:["5 Minuten","10 Minuten","20 Minuten"],correctIdx:1}]},
  {title:"Taxi rufen",lines:[{speaker:"Fahrgast",de:"Guten Abend, ich brauche ein Taxi zum Flughafen.",en:"Good evening, I need a taxi to the airport."},{speaker:"Taxifahrer",de:"Steigen Sie bitte ein. Haben Sie Gepäck?",en:"Please get in. Do you have luggage?"},{speaker:"Fahrgast",de:"Ja, zwei Koffer im Kofferraum, bitte.",en:"Yes, two suitcases in the trunk, please."},{speaker:"Taxifahrer",de:"Kein Problem. Wann ist Ihr Flug?",en:"No problem. When's your flight?"},{speaker:"Fahrgast",de:"Um halb neun. Schaffen wir das?",en:"At half past eight. Will we make it?"},{speaker:"Taxifahrer",de:"Locker. Es gibt kaum Verkehr.",en:"Easily. There's hardly any traffic."}],questions:[{q:"Wohin möchte der Fahrgast?",opts:["Zum Bahnhof","Zum Flughafen","Zum Hotel"],correctIdx:1},{q:"Wie viele Koffer hat er?",opts:["Einen","Zwei","Drei"],correctIdx:1}]},
  {title:"Frühstück im Hotel",lines:[{speaker:"Kellner",de:"Kaffee oder Tee?",en:"Coffee or tea?"},{speaker:"Gast",de:"Einen Kaffee, bitte. Mit Milch.",en:"A coffee, please. With milk."},{speaker:"Kellner",de:"Möchten Sie Eier zum Frühstück?",en:"Would you like eggs for breakfast?"},{speaker:"Gast",de:"Ja, Rührei mit Brötchen, bitte.",en:"Yes, scrambled eggs with a roll, please."},{speaker:"Kellner",de:"Kommt sofort.",en:"Coming right up."}],questions:[{q:"Was trinkt der Gast?",opts:["Tee","Kaffee mit Milch","Orangensaft"],correctIdx:1},{q:"Welche Eier bestellt er?",opts:["Spiegelei","Rührei","Gekochtes Ei"],correctIdx:1}]},
  {title:"Einkaufen — Kleidung",lines:[{speaker:"Kunde",de:"Entschuldigung, haben Sie diese Hose auch in Größe 32?",en:"Excuse me, do you have these trousers in size 32?"},{speaker:"Verkäuferin",de:"Einen Moment, ich schaue nach.",en:"One moment, I'll have a look."},{speaker:"Verkäuferin",de:"Ja, hier bitte. Möchten Sie sie anprobieren?",en:"Yes, here you go. Would you like to try them on?"},{speaker:"Kunde",de:"Gerne. Wo ist die Umkleide?",en:"Yes please. Where's the changing room?"},{speaker:"Verkäuferin",de:"Gleich dort hinten rechts.",en:"Just over there on the right."}],questions:[{q:"Welche Größe sucht der Kunde?",opts:["Größe 30","Größe 32","Größe 34"],correctIdx:1},{q:"Möchte er die Hose anprobieren?",opts:["Ja","Nein","Später"],correctIdx:0}]},
  {title:"Beim Frisör",lines:[{speaker:"Kunde",de:"Ich möchte die Haare schneiden lassen, bitte.",en:"I'd like to have my hair cut, please."},{speaker:"Frisör",de:"Wie kurz möchten Sie sie haben?",en:"How short would you like them?"},{speaker:"Kunde",de:"Nur die Spitzen, etwa zwei Zentimeter.",en:"Just the ends, about two centimetres."},{speaker:"Frisör",de:"Und waschen dazu?",en:"And a wash with that?"},{speaker:"Kunde",de:"Ja, bitte.",en:"Yes, please."}],questions:[{q:"Wie viel möchte der Kunde abschneiden?",opts:["1 cm","2 cm","5 cm"],correctIdx:1},{q:"Möchte er die Haare waschen lassen?",opts:["Ja","Nein","Nur föhnen"],correctIdx:0}]},
  {title:"Die Wohnung putzen",lines:[{speaker:"Mitbewohner A",de:"Hast du heute Zeit zu putzen?",en:"Do you have time to clean today?"},{speaker:"Mitbewohner B",de:"Leider nicht, ich muss arbeiten.",en:"Unfortunately not, I have to work."},{speaker:"Mitbewohner A",de:"Kannst du wenigstens den Müll rausbringen?",en:"Can you at least take out the rubbish?"},{speaker:"Mitbewohner B",de:"Ja, das mache ich gleich.",en:"Yes, I'll do that right away."}],questions:[{q:"Kann Mitbewohner B heute putzen?",opts:["Ja","Nein, er muss arbeiten","Später"],correctIdx:1},{q:"Was macht er trotzdem?",opts:["Staub saugen","Den Müll rausbringen","Kochen"],correctIdx:1}]},
  {title:"Geburtstag planen",lines:[{speaker:"Anna",de:"Nächste Woche habe ich Geburtstag.",en:"Next week is my birthday."},{speaker:"Tom",de:"Schön! Wie alt wirst du?",en:"Nice! How old are you turning?"},{speaker:"Anna",de:"26. Ich möchte eine kleine Feier machen.",en:"26. I'd like to have a small party."},{speaker:"Tom",de:"Darf ich kommen?",en:"May I come?"},{speaker:"Anna",de:"Klar, du bist eingeladen. Samstag um 19 Uhr bei mir.",en:"Sure, you're invited. Saturday at 7pm at mine."}],questions:[{q:"Wie alt wird Anna?",opts:["24","25","26"],correctIdx:2},{q:"Wann ist die Feier?",opts:["Freitag","Samstag","Sonntag"],correctIdx:1}]},
  {title:"Das Wetter",lines:[{speaker:"Freund A",de:"Was für ein Wetter heute!",en:"What weather today!"},{speaker:"Freund B",de:"Ja, es regnet schon den ganzen Tag.",en:"Yeah, it's been raining all day."},{speaker:"Freund A",de:"Morgen soll es besser werden.",en:"It's supposed to get better tomorrow."},{speaker:"Freund B",de:"Hoffentlich! Dann können wir spazieren gehen.",en:"Hopefully! Then we can go for a walk."}],questions:[{q:"Wie ist das Wetter heute?",opts:["Sonnig","Regnerisch","Windig"],correctIdx:1},{q:"Was planen sie für morgen?",opts:["Spazieren gehen","Kino","Zu Hause bleiben"],correctIdx:0}]},
  {title:"Urlaubspläne",lines:[{speaker:"Kollege",de:"Hast du schon Urlaubspläne?",en:"Do you have holiday plans yet?"},{speaker:"Freund",de:"Ja, ich fahre im August nach Italien.",en:"Yes, I'm going to Italy in August."},{speaker:"Kollege",de:"Wie lange bleibst du?",en:"How long are you staying?"},{speaker:"Freund",de:"Zwei Wochen. Und du?",en:"Two weeks. And you?"},{speaker:"Kollege",de:"Ich weiß noch nicht. Vielleicht nach Österreich.",en:"I don't know yet. Maybe Austria."}],questions:[{q:"Wohin fährt der Freund?",opts:["Spanien","Italien","Österreich"],correctIdx:1},{q:"Wie lange bleibt er?",opts:["1 Woche","2 Wochen","3 Wochen"],correctIdx:1}]},
  {title:"Fitnessstudio anmelden",lines:[{speaker:"Interessent",de:"Ich möchte mich anmelden.",en:"I'd like to sign up."},{speaker:"Mitarbeiter",de:"Welches Abo interessiert Sie?",en:"Which membership interests you?"},{speaker:"Interessent",de:"Was kostet das Jahresabo?",en:"How much is the yearly one?"},{speaker:"Mitarbeiter",de:"300 Euro, mit Sauna 360.",en:"300 euros, with sauna 360."},{speaker:"Interessent",de:"Ohne Sauna, bitte. Brauche ich einen Ausweis?",en:"Without sauna, please. Do I need an ID?"},{speaker:"Mitarbeiter",de:"Ja, Ausweis und Kontodaten.",en:"Yes, ID and bank details."}],questions:[{q:"Was kostet das Abo ohne Sauna?",opts:["300 €","360 €","250 €"],correctIdx:0},{q:"Was braucht der Interessent?",opts:["Nur einen Ausweis","Nur Kontodaten","Ausweis und Kontodaten"],correctIdx:2}]},
  {title:"Einen Freund einladen",lines:[{speaker:"Maria",de:"Hast du am Samstag was vor?",en:"Do you have plans Saturday?"},{speaker:"Peter",de:"Nichts Besonderes. Warum?",en:"Nothing special. Why?"},{speaker:"Maria",de:"Ich koche Abendessen. Hast du Lust?",en:"I'm cooking dinner. Want to come?"},{speaker:"Peter",de:"Sehr gerne. Was kochst du?",en:"I'd love to. What are you cooking?"},{speaker:"Maria",de:"Pasta mit Gemüse. Bringst du Wein mit?",en:"Pasta with vegetables. Can you bring wine?"},{speaker:"Peter",de:"Klar, mache ich.",en:"Sure, I'll do that."}],questions:[{q:"Was kocht Maria?",opts:["Fleisch","Pasta mit Gemüse","Pizza"],correctIdx:1},{q:"Was soll Peter mitbringen?",opts:["Brot","Wein","Nachtisch"],correctIdx:1}]},
  {title:"Im Fundbüro",lines:[{speaker:"Kunde",de:"Ich habe meinen Regenschirm verloren.",en:"I've lost my umbrella."},{speaker:"Beamter",de:"Wo haben Sie ihn zuletzt gesehen?",en:"Where did you last see it?"},{speaker:"Kunde",de:"Im Bus, Linie 42.",en:"On the bus, line 42."},{speaker:"Beamter",de:"Welche Farbe?",en:"What colour?"},{speaker:"Kunde",de:"Schwarz mit weißen Punkten.",en:"Black with white dots."},{speaker:"Beamter",de:"Einen Moment, ich schaue nach.",en:"One moment, I'll check."}],questions:[{q:"Was hat der Kunde verloren?",opts:["Seine Tasche","Seinen Regenschirm","Sein Handy"],correctIdx:1},{q:"Wo hat er es verloren?",opts:["Im Zug","Im Bus","Auf der Straße"],correctIdx:1}]},
  {title:"Paket abholen",lines:[{speaker:"Kunde",de:"Guten Tag, ich möchte ein Paket abholen.",en:"Hello, I'd like to pick up a parcel."},{speaker:"Angestellter",de:"Haben Sie die Abholnummer?",en:"Do you have the collection number?"},{speaker:"Kunde",de:"Ja, hier: 5847.",en:"Yes, here: 5847."},{speaker:"Angestellter",de:"Und Ihren Ausweis, bitte.",en:"And your ID, please."},{speaker:"Kunde",de:"Hier bitte.",en:"Here you go."},{speaker:"Angestellter",de:"Moment, ich hole das Paket.",en:"One moment, I'll fetch the parcel."}],questions:[{q:"Was macht der Kunde?",opts:["Ein Paket verschicken","Ein Paket abholen","Briefmarken kaufen"],correctIdx:1},{q:"Was braucht der Angestellte?",opts:["Nur die Nummer","Nur den Ausweis","Nummer und Ausweis"],correctIdx:2}]},
  {title:"Freunde im Fitnessstudio",lines:[{speaker:"Anna",de:"Gehst du auch nach der Arbeit zum Training?",en:"Going to training after work too?"},{speaker:"Ben",de:"Ja, treffen wir uns dort?",en:"Yes, shall we meet there?"},{speaker:"Anna",de:"Gerne. Um sechs?",en:"Sounds good. At six?"},{speaker:"Ben",de:"Lieber halb sieben, ich bin müde.",en:"Better half past six, I'm tired."},{speaker:"Anna",de:"Okay, bis dann!",en:"Okay, see you then!"}],questions:[{q:"Wann treffen sie sich?",opts:["18:00","18:30","19:00"],correctIdx:1},{q:"Warum später?",opts:["Ben ist müde","Anna arbeitet länger","Das Studio öffnet später"],correctIdx:0}]},
  {title:"Tisch reservieren",lines:[{speaker:"Gast",de:"Guten Tag, ich möchte einen Tisch reservieren.",en:"Hello, I'd like to reserve a table."},{speaker:"Kellner",de:"Für wann und wie viele Personen?",en:"For when and how many people?"},{speaker:"Gast",de:"Samstagabend, vier Personen.",en:"Saturday evening, four people."},{speaker:"Kellner",de:"Um wie viel Uhr?",en:"At what time?"},{speaker:"Gast",de:"Um halb acht, bitte.",en:"At half past seven, please."},{speaker:"Kellner",de:"In Ordnung. Auf welchen Namen?",en:"All right. Under which name?"},{speaker:"Gast",de:"Schmidt.",en:"Schmidt."}],questions:[{q:"Für wie viele Personen?",opts:["Zwei","Drei","Vier"],correctIdx:2},{q:"Wann ist die Reservierung?",opts:["19:00","19:30","20:00"],correctIdx:1}]},
  {title:"Kontoeröffnung bei der Bank",lines:[{speaker:"Kunde",de:"Ich möchte ein Konto eröffnen.",en:"I'd like to open an account."},{speaker:"Bankangestellter",de:"Welche Art von Konto?",en:"What kind of account?"},{speaker:"Kunde",de:"Ein Girokonto, bitte.",en:"A current account, please."},{speaker:"Bankangestellter",de:"Haben Sie einen Ausweis und eine Meldebescheinigung?",en:"Do you have ID and proof of residence?"},{speaker:"Kunde",de:"Ja, beides hier.",en:"Yes, both here."},{speaker:"Bankangestellter",de:"Sehr gut. Es dauert etwa zwanzig Minuten.",en:"Very good. It takes about twenty minutes."}],questions:[{q:"Welches Konto möchte der Kunde?",opts:["Sparkonto","Girokonto","Kreditkartenkonto"],correctIdx:1},{q:"Wie lange dauert es?",opts:["10 Minuten","20 Minuten","30 Minuten"],correctIdx:1}]}
];


// ── IMPERATIV DATA (65 cards — A2 level) ──
const IMPERATIVES = [
  {base:"machen",en:"make / do",du:"mach",ihr:"macht",sie:"machen Sie",hint:"regular",ex:"Mach bitte das Fenster zu!"},
  {base:"lernen",en:"learn / study",du:"lern",ihr:"lernt",sie:"lernen Sie",hint:"regular",ex:"Lern mal für die Prüfung!"},
  {base:"hören",en:"listen",du:"hör",ihr:"hört",sie:"hören Sie",hint:"regular",ex:"Hör doch auf!"},
  {base:"kaufen",en:"buy",du:"kauf",ihr:"kauft",sie:"kaufen Sie",hint:"regular",ex:"Kauf bitte Milch."},
  {base:"spielen",en:"play",du:"spiel",ihr:"spielt",sie:"spielen Sie",hint:"regular",ex:"Spielt nicht so laut!"},
  {base:"kochen",en:"cook",du:"koch",ihr:"kocht",sie:"kochen Sie",hint:"regular",ex:"Koch doch mal etwas Leckeres!"},
  {base:"wohnen",en:"live / reside",du:"wohn",ihr:"wohnt",sie:"wohnen Sie",hint:"regular",ex:"Wohnen Sie bei uns!"},
  {base:"fragen",en:"ask",du:"frag",ihr:"fragt",sie:"fragen Sie",hint:"regular",ex:"Frag einfach deinen Lehrer."},
  {base:"sagen",en:"say",du:"sag",ihr:"sagt",sie:"sagen Sie",hint:"regular",ex:"Sag mir die Wahrheit!"},
  {base:"zeigen",en:"show",du:"zeig",ihr:"zeigt",sie:"zeigen Sie",hint:"regular",ex:"Zeig mir dein neues Handy!"},
  {base:"suchen",en:"look for",du:"such",ihr:"sucht",sie:"suchen Sie",hint:"regular",ex:"Such mal in deiner Tasche."},
  {base:"brauchen",en:"need",du:"brauch",ihr:"braucht",sie:"brauchen Sie",hint:"regular",ex:"Brauch dich nicht zu beeilen."},
  {base:"glauben",en:"believe",du:"glaub",ihr:"glaubt",sie:"glauben Sie",hint:"regular",ex:"Glaub mir doch!"},
  {base:"hoffen",en:"hope",du:"hoff",ihr:"hofft",sie:"hoffen Sie",hint:"regular",ex:"Hoff auf das Beste."},
  {base:"lachen",en:"laugh",du:"lach",ihr:"lacht",sie:"lachen Sie",hint:"regular",ex:"Lach doch mal!"},
  {base:"tanzen",en:"dance",du:"tanz",ihr:"tanzt",sie:"tanzen Sie",hint:"regular",ex:"Tanz mit mir!"},
  {base:"üben",en:"practise",du:"üb",ihr:"übt",sie:"üben Sie",hint:"regular",ex:"Üb jeden Tag ein bisschen."},
  {base:"zahlen",en:"pay",du:"zahl",ihr:"zahlt",sie:"zahlen Sie",hint:"regular",ex:"Zahlen Sie bitte an der Kasse."},
  {base:"stellen",en:"put / place",du:"stell",ihr:"stellt",sie:"stellen Sie",hint:"regular",ex:"Stell die Flasche in den Kühlschrank."},
  {base:"legen",en:"lay / put down",du:"leg",ihr:"legt",sie:"legen Sie",hint:"regular",ex:"Leg das Buch auf den Tisch."},
  {base:"arbeiten",en:"work",du:"arbeite",ihr:"arbeitet",sie:"arbeiten Sie",hint:"+e: stem ends in -t",ex:"Arbeite nicht so viel!"},
  {base:"warten",en:"wait",du:"warte",ihr:"wartet",sie:"warten Sie",hint:"+e: stem ends in -t",ex:"Warte mal auf mich!"},
  {base:"antworten",en:"answer",du:"antworte",ihr:"antwortet",sie:"antworten Sie",hint:"+e: stem ends in -t",ex:"Antworte bitte ehrlich."},
  {base:"reden",en:"talk / speak",du:"rede",ihr:"redet",sie:"reden Sie",hint:"+e: stem ends in -d",ex:"Rede doch mit ihm!"},
  {base:"öffnen",en:"open",du:"öffne",ihr:"öffnet",sie:"öffnen Sie",hint:"+e: consonant cluster",ex:"Öffne bitte das Fenster!"},
  {base:"geben",en:"give",du:"gib",ihr:"gebt",sie:"geben Sie",hint:"e→i: du gibst → gib",ex:"Gib mir bitte das Salz!"},
  {base:"nehmen",en:"take",du:"nimm",ihr:"nehmt",sie:"nehmen Sie",hint:"e→i: du nimmst → nimm",ex:"Nimm dir ein Stück Kuchen."},
  {base:"essen",en:"eat",du:"iss",ihr:"esst",sie:"essen Sie",hint:"e→i: du isst → iss",ex:"Iss doch dein Gemüse!"},
  {base:"helfen",en:"help",du:"hilf",ihr:"helft",sie:"helfen Sie",hint:"e→i: du hilfst → hilf",ex:"Hilf mir bitte mal!"},
  {base:"sprechen",en:"speak",du:"sprich",ihr:"sprecht",sie:"sprechen Sie",hint:"e→i: du sprichst → sprich",ex:"Sprich lauter, bitte."},
  {base:"treffen",en:"meet",du:"triff",ihr:"trefft",sie:"treffen Sie",hint:"e→i: du triffst → triff",ex:"Triff mich vor dem Kino."},
  {base:"vergessen",en:"forget",du:"vergiss",ihr:"vergesst",sie:"vergessen Sie",hint:"e→i: du vergisst → vergiss",ex:"Vergiss deinen Schlüssel nicht!"},
  {base:"werfen",en:"throw",du:"wirf",ihr:"werft",sie:"werfen Sie",hint:"e→i: du wirfst → wirf",ex:"Wirf mir den Ball!"},
  {base:"lesen",en:"read",du:"lies",ihr:"lest",sie:"lesen Sie",hint:"e→ie: du liest → lies",ex:"Lies das Buch mal!"},
  {base:"sehen",en:"see / look",du:"sieh",ihr:"seht",sie:"sehen Sie",hint:"e→ie: du siehst → sieh",ex:"Sieh doch mal hierher!"},
  {base:"empfehlen",en:"recommend",du:"empfiehl",ihr:"empfehlt",sie:"empfehlen Sie",hint:"e→ie: du empfiehlst → empfiehl",ex:"Empfiehl mir ein gutes Restaurant."},
  {base:"sterben",en:"die",du:"stirb",ihr:"sterbt",sie:"sterben Sie",hint:"e→i (literary)",ex:"Stirb nicht, bleib bei mir!"},
  {base:"fahren",en:"drive / go",du:"fahr",ihr:"fahrt",sie:"fahren Sie",hint:"NO ä in imperative — just fahr",ex:"Fahr vorsichtig!"},
  {base:"schlafen",en:"sleep",du:"schlaf",ihr:"schlaft",sie:"schlafen Sie",hint:"NO ä in imperative — just schlaf",ex:"Schlaf gut!"},
  {base:"tragen",en:"carry / wear",du:"trag",ihr:"tragt",sie:"tragen Sie",hint:"NO ä in imperative — just trag",ex:"Trag bitte die Tasche für mich."},
  {base:"laufen",en:"run / walk",du:"lauf",ihr:"lauft",sie:"laufen Sie",hint:"NO äu in imperative — just lauf",ex:"Lauf nicht so schnell!"},
  {base:"lassen",en:"let / leave",du:"lass",ihr:"lasst",sie:"lassen Sie",hint:"NO ä in imperative — just lass",ex:"Lass mich in Ruhe!"},
  {base:"waschen",en:"wash",du:"wasch",ihr:"wascht",sie:"waschen Sie",hint:"NO ä in imperative — just wasch",ex:"Wasch dir die Hände!"},
  {base:"sein",en:"be",du:"sei",ihr:"seid",sie:"seien Sie",hint:"fully irregular: sei / seid / seien Sie",ex:"Sei bitte ruhig!"},
  {base:"haben",en:"have",du:"hab",ihr:"habt",sie:"haben Sie",hint:"hab (drop -e) / habt / haben Sie",ex:"Hab keine Angst!"},
  {base:"werden",en:"become",du:"werd",ihr:"werdet",sie:"werden Sie",hint:"werd / werdet / werden Sie",ex:"Werde bitte nicht wütend!"},
  {base:"wissen",en:"know",du:"wiss",ihr:"wisst",sie:"wissen Sie",hint:"wiss / wisst / wissen Sie (rare)",ex:"Wisst, dass ich euch liebe."},
  {base:"aufstehen",en:"get up",du:"steh auf",ihr:"steht auf",sie:"stehen Sie auf",hint:"separable: prefix goes to END",ex:"Steh bitte endlich auf!"},
  {base:"anrufen",en:"phone / call",du:"ruf an",ihr:"ruft an",sie:"rufen Sie an",hint:"separable: prefix goes to END",ex:"Ruf mich morgen an!"},
  {base:"zuhören",en:"listen up",du:"hör zu",ihr:"hört zu",sie:"hören Sie zu",hint:"separable: prefix goes to END",ex:"Hör mir bitte zu!"},
  {base:"mitkommen",en:"come along",du:"komm mit",ihr:"kommt mit",sie:"kommen Sie mit",hint:"separable: prefix goes to END",ex:"Komm doch mit!"},
  {base:"mitbringen",en:"bring along",du:"bring mit",ihr:"bringt mit",sie:"bringen Sie mit",hint:"separable: prefix goes to END",ex:"Bring bitte Wein mit!"},
  {base:"ausmachen",en:"switch off",du:"mach aus",ihr:"macht aus",sie:"machen Sie aus",hint:"separable: prefix goes to END",ex:"Mach das Licht aus!"},
  {base:"anmachen",en:"switch on",du:"mach an",ihr:"macht an",sie:"machen Sie an",hint:"separable: prefix goes to END",ex:"Mach das Radio an!"},
  {base:"aufhören",en:"stop / quit",du:"hör auf",ihr:"hört auf",sie:"hören Sie auf",hint:"separable: prefix goes to END",ex:"Hör sofort auf!"},
  {base:"anfangen",en:"start / begin",du:"fang an",ihr:"fangt an",sie:"fangen Sie an",hint:"separable: prefix goes to END",ex:"Fang endlich an!"},
  {base:"einsteigen",en:"get in / on",du:"steig ein",ihr:"steigt ein",sie:"steigen Sie ein",hint:"separable: prefix goes to END",ex:"Steig bitte ein!"},
  {base:"aussteigen",en:"get out / off",du:"steig aus",ihr:"steigt aus",sie:"steigen Sie aus",hint:"separable: prefix goes to END",ex:"Steig an der nächsten Haltestelle aus."},
  {base:"abholen",en:"pick up",du:"hol ab",ihr:"holt ab",sie:"holen Sie ab",hint:"separable: prefix goes to END",ex:"Hol mich vom Bahnhof ab!"},
  {base:"sich setzen",en:"sit down",du:"setz dich",ihr:"setzt euch",sie:"setzen Sie sich",hint:"reflexive: dich / euch / sich",ex:"Setz dich doch!"},
  {base:"sich beeilen",en:"hurry up",du:"beeil dich",ihr:"beeilt euch",sie:"beeilen Sie sich",hint:"reflexive: dich / euch / sich",ex:"Beeil dich, wir sind spät!"},
  {base:"sich freuen",en:"be happy",du:"freu dich",ihr:"freut euch",sie:"freuen Sie sich",hint:"reflexive: dich / euch / sich",ex:"Freu dich doch!"},
  {base:"sich entspannen",en:"relax",du:"entspann dich",ihr:"entspannt euch",sie:"entspannen Sie sich",hint:"reflexive: dich / euch / sich",ex:"Entspann dich mal!"},
  {base:"kommen",en:"come",du:"komm",ihr:"kommt",sie:"kommen Sie",hint:"regular, frequent",ex:"Komm bitte her!"},
  {base:"gehen",en:"go",du:"geh",ihr:"geht",sie:"gehen Sie",hint:"regular, frequent",ex:"Geh nach Hause!"}
];

// ── HELPERS — UNCHANGED except additions noted ──
// Compact sparse category arrays once up front. The source data contains blank
// entries between category additions; methods like `.find()` do visit those
// slots and can crash on `w.de` unless we normalize here.
const compactWordList = (list) => (Array.isArray(list) ? list.filter(w => w && typeof w === "object" && typeof w.de === "string") : []);
Object.keys(V).forEach(cat => {
  V[cat] = compactWordList(V[cat]);
});

const sh = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = 0 | Math.random() * (i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const PRONS = ["ich","du","er/sie/es","wir","ihr","sie/Sie"];
const PK = {ich:"ich",du:"du","er/sie/es":"er",wir:"wir",ihr:"ihr","sie/Sie":"sie"};
const CATS = Object.keys(V);

// Normalize a progress entry to {stats, srs} schema.
// Accepts new shape, old flat {box, fails, hits, avgMs, n, ts}, or undefined.
function normalizeEntry(p) {
  if (!p) return { stats: { attempts: 0, correct: 0, incorrect: 0, avgTime: 0 }, srs: { box: 0 } };
  if (p.stats && p.srs) return p;
  return {
    stats: { attempts: p.n || 0, correct: p.hits || 0, incorrect: p.fails || 0, lastSeen: p.ts, avgTime: p.avgMs || 0 },
    srs: { box: p.box || 0, lastReviewed: p.ts },
  };
}

// Deterministic id from any card shape
const cardId = (card) => card._id || card.de || card.q || card.a || (card.article && card.noun ? `${card.article} ${card.noun}` : null) || (card.verb ? `${card.verb}-${card.pron}-${card.tense}` : null) || (card.correct && card.correct.join(" ")) || "unknown";

const MODE_SUMMARY_LABELS = {
  vocab: "recognition",
  production: "production",
  article: "articles",
  cloze: "cloze",
  verb: "verbs",
  sentence: "sentences",
  imperativ: "imperative",
  listening: "listening",
  audio: "audio",
};
const modeSummaryLabel = (mode) => MODE_SUMMARY_LABELS[mode] || mode;
const formatModeBreakdown = (byMode) => Object.entries(byMode).map(([m, arr]) => `${arr.length} ${modeSummaryLabel(m)}`).join(" · ");

function getNouns() {
  const n = [];
  Object.entries(V).forEach(([c, ws]) => { ws.forEach(w => { if (!w?.de) return; const m = w.de.match(/^(der|die|das) (.+)$/); if (m) n.push({ article: m[1], noun: m[2], en: w.en, cat: c }); }); });
  return n;
}

function makeVerbQ(tense = "present") {
  const vb = VERBS[0 | Math.random() * VERBS.length];
  const pron = PRONS[0 | Math.random() * PRONS.length];
  const key = PK[pron];
  if (tense === "perfekt") {
    const parts = vb.pf.split(" ");
    const auxF = parts[0] === "ist" ? "sein" : "haben";
    const auxV = VERBS.find(v => v.v === auxF);
    const correctAux = auxV ? auxV.pr[key] : parts[0];
    const pp = parts[1];
    return { verb: vb.v, en: vb.en, pron, correct: `${correctAux} ${pp}`, tense: "Perfekt", hint: `${vb.v} → ${vb.aux} + ${pp}` };
  }
  const correct = vb.pr[key];
  const allF = [...new Set(Object.values(vb.pr))].filter(f => f !== correct);
  const wrongs = sh(allF).slice(0, 3); while (wrongs.length < 3) wrongs.push(correct + "e");
  const opts = sh([correct, ...wrongs]);
  return { verb: vb.v, en: vb.en, pron, correct, opts, correctIdx: opts.indexOf(correct), tense: "Präsens", hint: `${pron} → ${correct}` };
}

// Unified speech helper. Returns a Promise that resolves when the utterance ends
// (or immediately if Speech Synthesis is unavailable / text is empty). All three
// TTS call sites in the app flow through this.
function speakWith(text, lang = "de-DE", rate = 0.85) {
  return new Promise(resolve => {
    if (!window.speechSynthesis || !text) { resolve(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    const pref = voices.find(v => v.lang.startsWith(lang.slice(0, 2)));
    if (pref) u.voice = pref;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

// Fire-and-forget wrapper used by tap-to-speak buttons (UI doesn't await).
function speak(text) { speakWith(text); }

function normalize(s) { return s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9 ]/g, "").trim(); }

// True "within one edit" check — handles single insertion, deletion, or substitution.
// The previous position-compare version failed on insertions because a single inserted
// character cascaded into N mismatches.
function within1Edit(a, b) {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  // Find first divergence
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  // Same length → substitution: skip one char in each, rest must match
  if (la === lb) return a.slice(i + 1) === b.slice(i + 1);
  // Different length → insertion/deletion: skip one char in the longer, rest must match
  const longer = la > lb ? a : b;
  const shorter = la > lb ? b : a;
  return longer.slice(i + 1) === shorter.slice(i);
}

function checkMatch(input, target) {
  const ni = normalize(input), nt = normalize(target);
  if (ni === nt) return "exact";
  const parts = target.split("/").map(s => s.trim());
  for (const p of parts) if (normalize(p) === ni) return "exact";
  if (within1Edit(ni, nt)) return "close";
  return "wrong";
}

// Common German strong-verb + modal stem alternates. Used by the example highlighter
// so "nehmen" matches "nimm", "sprechen" matches "sprich", etc. Not exhaustive — covers
// the high-frequency A1/A2 verbs that appear in example sentences.
const STEM_ALTS = {
  nehmen: ["nehm", "nimm", "nahm", "nomm"],
  sprechen: ["sprech", "sprich", "sprach", "sproch"],
  sehen: ["seh", "sieh", "sah"],
  lesen: ["les", "lies", "las"],
  essen: ["ess", "iss", "aß", "gess"],
  geben: ["geb", "gib", "gab"],
  treffen: ["treff", "triff", "traf"],
  helfen: ["helf", "hilf", "half"],
  werfen: ["werf", "wirf", "warf"],
  vergessen: ["vergess", "vergiss", "vergaß"],
  empfehlen: ["empfehl", "empfiehl", "empfahl"],
  fahren: ["fahr", "fähr", "fuhr"],
  laufen: ["lauf", "läuf", "lief"],
  tragen: ["trag", "träg", "trug"],
  schlafen: ["schlaf", "schläf", "schlief"],
  waschen: ["wasch", "wäsch", "wusch"],
  müssen: ["müss", "muss"],
  können: ["könn", "kann"],
  dürfen: ["dürf", "darf"],
  wollen: ["woll", "will"],
  mögen: ["mög", "mag", "möcht"],
  wissen: ["wiss", "weiß", "wuss"],
  werden: ["werd", "wird", "wurde", "word"],
  haben: ["hab", "hat", "hatt"],
  sein: ["sei", "bin", "bist", "ist", "sind", "seid", "war"],
  kommen: ["komm", "kam"],
  gehen: ["geh", "ging", "gang"],
  finden: ["find", "fand", "fund"],
  denken: ["denk", "dach", "dacht"],
  bringen: ["bring", "brach", "bracht"],
  schreiben: ["schreib", "schrieb"],
  bleiben: ["bleib", "blieb"],
  sterben: ["sterb", "stirb", "starb", "storb"],
  anziehen: ["anzieh", "zieh", "zog"],
  aufstehen: ["aufsteh", "steh", "stand"],
  anrufen: ["anruf", "ruf", "rief"],
};
// The returned pattern is NOT escaped for regex metacharacters beyond those present in
// German words (assumed safe). Used only for vocab where inputs are controlled.
function buildUmlautTolerant(term) {
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return escape(term)
    .replace(/ä/gi, "(?:ä|ae)")
    .replace(/ö/gi, "(?:ö|oe)")
    .replace(/ü/gi, "(?:ü|ue)")
    .replace(/ß/gi, "(?:ß|ss)")
    .replace(/ae/gi, "(?:ae|ä)")
    .replace(/oe/gi, "(?:oe|ö)")
    .replace(/ue/gi, "(?:ue|ü)")
    .replace(/ss/gi, "(?:ss|ß)");
}

// Highlighter for the example-sentence panel. Given a German target (card.de) and an
// example string, return [{text, hl}, ...] parts where `hl=true` denotes highlighted.
//   - Strips leading article from the target to get the core phrase.
//   - Tries the full phrase first (exact match, case + umlaut insensitive, all occurrences).
//   - Falls back to matching each content word (3+ chars, not stopwords).
//   - Single-word matches use a stem+suffix pattern so "fahren" catches "fährt", "gefahren".
//   - Stopwords (sich/dich/der/zu/etc.) are never highlighted.
function highlightExample(ex, de) {
  if (!ex) return [];
  if (!de) return [{ text: ex, hl: false }];

  const stripped = de.replace(/^(der|die|das)\s+/i, "").trim();
  const STOPWORDS = /^(sich|dich|mich|dir|mir|euch|uns|zu|an|auf|mit|von|aus|bei|in|im|am|der|die|das|den|dem|des|ein|eine|einen|einer|einem|eines)$/i;

  const words = stripped.split(/\s+/)
    .map(w => w.replace(/[.,!?;:]+$/, ""))
    .filter(w => w.length >= 3 && !STOPWORDS.test(w));

  // Build ordered patterns (phrase before individual words so phrase wins when present)
  const patterns = [];
  if (stripped.split(/\s+/).length > 1 && stripped.length >= 4) {
    patterns.push(buildUmlautTolerant(stripped));
  }
  for (const w of words) {
    // If we know this word's strong-verb stems, add all of them
    const lc = w.toLowerCase();
    const alts = STEM_ALTS[lc];
    if (alts) {
      for (const a of alts) patterns.push("\\b" + buildUmlautTolerant(a) + "\\w*");
    } else {
      // Generic stem: first 4 chars + any word-char tail
      const stemLen = Math.min(w.length, 4);
      const stem = w.slice(0, stemLen);
      patterns.push("\\b" + buildUmlautTolerant(stem) + "\\w*");
    }
  }
  if (patterns.length === 0) return [{ text: ex, hl: false }];

  const combined = new RegExp("(" + patterns.join("|") + ")", "gi");
  const parts = [];
  let lastIndex = 0;
  let m;
  while ((m = combined.exec(ex)) !== null) {
    if (m[0].length === 0) { combined.lastIndex++; continue; }
    if (m.index > lastIndex) parts.push({ text: ex.slice(lastIndex, m.index), hl: false });
    parts.push({ text: m[0], hl: true });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < ex.length) parts.push({ text: ex.slice(lastIndex), hl: false });
  return parts;
}

// ── NEW: Automaticity label ──
function speedLabel(ms) {
  if (ms < 8000) return { text: "Automatic", color: "#4ADE80" };
  if (ms < 15000) return { text: "Building recall", color: "#FBBF24" };
  return { text: "Needs work", color: "#DD0000" };
}

// ── Difficulty-weighted + performance-aware selection ──
// Soft boost for struggling cards using existing stats. Does NOT duplicate leech detection
// (leeches are incorrect>=4 AND box<3 — handled separately by weak-area flow).
// Max boost is 1.8x, so no card can dominate a session.
function perfMultiplier(entry) {
  if (!entry) return 1;
  const n = normalizeEntry(entry);
  const { attempts, correct, incorrect, avgTime } = n.stats;
  if (attempts < 2) return 1; // too little data to trust
  let mult = 1;
  // High incorrect count
  if (incorrect >= 3) mult += 0.4;
  else if (incorrect >= 2) mult += 0.2;
  // Low accuracy ratio
  const acc = correct / attempts;
  if (acc < 0.5) mult += 0.3;
  else if (acc < 0.7) mult += 0.15;
  // Slow response
  if (avgTime > 15000) mult += 0.2;
  else if (avgTime > 10000) mult += 0.1;
  return Math.min(mult, 1.8);
}

// Session-difficulty selector. Selection-order only — does NOT affect SRS or scoring.
// mixed: current behaviour (uses perfMultiplier as-is)
// easy: boosts higher-box / faster / more-accurate cards (revision-style)
// hard: amplifies perfMultiplier boost + adds box-level boost (drills weak stuff)
function sessionMultiplier(entry, diffMode) {
  if (diffMode === "mixed" || !diffMode) return perfMultiplier(entry);
  if (!entry) return 1;
  const n = normalizeEntry(entry);
  const { attempts, correct, incorrect, avgTime } = n.stats;
  const box = n.srs.box || 0;
  if (attempts < 2 && diffMode === "easy") return 0.7; // un-tested cards slightly less likely in easy mode
  if (attempts < 2) return 1;
  if (diffMode === "easy") {
    // Prioritise higher box (mastered), fast, accurate
    let mult = 1;
    if (box >= 4) mult += 0.6;
    else if (box >= 3) mult += 0.4;
    else if (box >= 2) mult += 0.2;
    else if (box <= 1) mult -= 0.4;
    const acc = correct / attempts;
    if (acc >= 0.85) mult += 0.2;
    if (avgTime > 0 && avgTime < 8000) mult += 0.15;
    return Math.max(0.3, Math.min(mult, 2.0));
  }
  // hard
  let mult = perfMultiplier(entry);
  // Amplify existing performance boost further
  if (incorrect >= 3) mult += 0.3;
  if (box <= 1) mult += 0.4;
  else if (box <= 2) mult += 0.2;
  // Leech-like cards (independent of weak-area flow): 4+ incorrect AND box < 3
  if (incorrect >= 4 && box < 3) mult += 0.5;
  if (avgTime > 15000) mult += 0.1;
  return Math.min(mult, 2.5);
}

function weightedSelect(pool, count, getMultiplier) {
  const weighted = [];
  pool.forEach(c => {
    const baseW = c.diff === "hard" ? 3 : c.diff === "medium" ? 2 : 1;
    const m = getMultiplier ? getMultiplier(c) : 1;
    const w = Math.max(1, Math.round(baseW * m));
    for (let i = 0; i < w; i++) weighted.push(c);
  });
  const picked = new Set();
  const result = [];
  const shuffled = sh(weighted);
  for (const c of shuffled) {
    const id = c.de || c.q || JSON.stringify(c.correct);
    if (!picked.has(id)) { picked.add(id); result.push(c); }
    if (result.length >= count) break;
  }
  return result;
}

// ── NEW: today key for streak tracking ──
function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ── Color palette (module scope so hoisted components can reference) ──
const PAL = {
  A: "#FFCC00", AD: "#CC9900", BG: "#0A0A0A", S: "#111111", SH: "#1A1A1A", B: "#2A2A2A",
  G: "#4ADE80", R: "#DD0000", T: "#F0EDE5", TD: "#8A857D", BL: "#60A5FA", CARD: "#151515",
};

// Visible in Settings → App Updates. Bump whenever you deploy a meaningful change
// so you can confirm at a glance which build is running on the device.
const APP_VERSION = "2026.04.25.5";

const ICONS = {
  settings: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.5 3.5a7.5 7.5 0 0 0-.08-1.1l2.08-1.6-2-3.46-2.45 1a8.2 8.2 0 0 0-1.9-1.1L15.8 3h-4l-.35 2.74a8.2 8.2 0 0 0-1.9 1.1l-2.45-1-2 3.46 2.08 1.6a7.5 7.5 0 0 0 0 2.2L5.1 14.7l2 3.46 2.45-1a8.2 8.2 0 0 0 1.9 1.1L11.8 21h4l.35-2.74a8.2 8.2 0 0 0 1.9-1.1l2.45 1 2-3.46-2.08-1.6c.05-.36.08-.73.08-1.1Z",
  play: "M8 5v14l11-7-11-7Z",
  pause: "M8 5h3v14H8V5Zm5 0h3v14h-3V5Z",
  skipBack: "M19 5v14l-9-7 9-7ZM5 5v14",
  skipForward: "M5 5v14l9-7-9-7ZM19 5v14",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  refresh: "M20 6v5h-5M4 18v-5h5M18.5 9a7 7 0 0 0-12-2.5L4 9m16 6-2.5 2.5A7 7 0 0 1 5.5 15",
  book: "M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 0-4-4V4Zm0 0v12",
  layers: "M12 3 3 8l9 5 9-5-9-5Zm-7 9 7 4 7-4M5 16l7 4 7-4",
  headphones: "M4 13a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-2v-7h4M4 13h4v7H6a2 2 0 0 1-2-2v-5Z",
  keyboard: "M4 7h16v10H4V7Zm3 3h.01M10 10h.01M13 10h.01M16 10h.01M7 14h10",
  target: "M12 3v3M12 18v3M3 12h3M18 12h3M7.5 7.5l2.1 2.1M14.4 14.4l2.1 2.1M16.5 7.5l-2.1 2.1M9.6 14.4l-2.1 2.1M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  calendar: "M7 3v3M17 3v3M4 8h16M5 5h14v16H5V5Z",
  clock: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v4l3 2",
  chart: "M5 19V5M5 19h15M9 16v-5M13 16V8M17 16v-8",
  check: "M20 6 9 17l-5-5",
  shield: "M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6l-7-3Z",
  wifi: "M5 10a10 10 0 0 1 14 0M8 13a6 6 0 0 1 8 0M11 16a2 2 0 0 1 2 0M12 19h.01",
  save: "M5 4h12l2 2v14H5V4Zm3 0v6h8V4M8 20v-6h8v6",
  upload: "M12 16V4M7 9l5-5 5 5M5 20h14",
  download: "M12 4v12M7 11l5 5 5-5M5 20h14",
  volume: "M4 10v4h4l5 4V6l-5 4H4Zm13-2a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14",
  home: "M4 11 12 4l8 7v9h-5v-6H9v6H4v-9Z",
  users: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-1a3 3 0 1 0 0-6M2 20a6 6 0 0 1 12 0M14 20a5 5 0 0 1 8 0",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  palette: "M12 4a8 8 0 0 0 0 16h1.5a2 2 0 0 0 1.4-3.4l-.3-.3a1 1 0 0 1 .7-1.7H17a5 5 0 0 0 0-10H12ZM7.5 11h.01M9.5 8h.01M13 7.5h.01",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  cloud: "M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11-2A5 5 0 0 0 7 18Z",
  map: "M9 18 4 20V6l5-2 6 2 5-2v14l-5 2-6-2Zm0 0V4m6 16V6",
  briefcase: "M9 6V4h6v2M4 7h16v12H4V7Zm0 5h16",
  message: "M4 5h16v11H8l-4 4V5Z",
  chip: "M8 8h8v8H8V8Zm-4 3h4M4 15h4M16 11h4M16 15h4M11 4v4M15 4v4M11 16v4M15 16v4",
  trophy: "M8 4h8v3a4 4 0 0 1-8 0V4Zm0 1H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5M12 11v5M9 20h6M10 16h4",
  link: "M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1",
};

const Icon = React.memo(({ name, size = 18, stroke = 1.8, style }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" style={{ display: "block", flexShrink: 0, ...style }}>
    <path d={ICONS[name] || ICONS.book} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
));

const IconBadge = React.memo(({ name, color = PAL.A, bg = "#0A0A0A66", size = 32 }) => (
  <span style={{ width: size, height: size, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", color, background: bg, border: `1px solid ${color}22`, flexShrink: 0 }}>
    <Icon name={name} size={Math.max(16, size - 14)} />
  </span>
));

// ── Hoisted stateless components — defined once at module scope instead of
// re-created every App render. The three heaviest-used components in the tree. ──
class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error && error.message ? error.message : "Unexpected render error"
    };
  }

  componentDidCatch(error, info) {
    try {
      localStorage.setItem("ad-last-error-v1", JSON.stringify({
        at: new Date().toISOString(),
        message: error && error.message ? error.message : String(error),
        stack: error && error.stack ? error.stack : "",
        componentStack: info && info.componentStack ? info.componentStack : ""
      }));
    } catch (e) {}
  }

  restartApp = ({ clearSession = false } = {}) => {
    try {
      localStorage.removeItem("ad-last-error-v1");
      if (clearSession) localStorage.removeItem("gfc-last-v7");
    } catch (e) {}
    const url = new URL(window.location.href);
    url.searchParams.set("recover", String(Date.now()));
    window.location.replace(url.toString());
  };

  reloadApp = () => {
    this.restartApp();
  };

  resetSessionAndReload = () => {
    this.restartApp({ clearSession: true });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{ minHeight: "100vh", background: PAL.BG, color: PAL.T, padding: "40px 24px 24px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Montserrat',sans-serif" }}>
        <div style={{ width: "100%", maxWidth: 360, background: "linear-gradient(180deg, #171717 0%, #101010 100%)", border: `1px solid ${PAL.B}`, borderRadius: 16, padding: "24px 22px", textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.35)" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <IconBadge name="refresh" size={38} color={PAL.A} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>App recovered</div>
          <div style={{ color: PAL.TD, fontSize: 13, lineHeight: 1.5, marginBottom: 18 }}>
            AutoDeutsch hit an unexpected error and stopped the current screen. Your saved progress is still on this device.
          </div>
          <button
            type="button"
            onClick={this.reloadApp}
            style={{ width: "100%", height: 48, borderRadius: 12, border: "none", background: PAL.A, color: PAL.BG, fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer", marginBottom: 10 }}>
            Reload app
          </button>
          <button
            type="button"
            onClick={this.resetSessionAndReload}
            style={{ width: "100%", height: 46, borderRadius: 12, border: `1px solid ${PAL.B}`, background: "#161616", color: PAL.T, fontFamily: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Reset current session
          </button>
          {this.state.message && <div style={{ marginTop: 14, fontSize: 11, color: PAL.TD, wordBreak: "break-word" }}>
            {this.state.message}
          </div>}
        </div>
      </div>
    );
  }
}

const Btn = React.memo(({ children, bg, color, border, onClick, style: s, ariaLabel }) => (
  <button type="button" aria-label={ariaLabel} onClick={onClick} style={{ padding: "16px", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: "pointer", border: border || "none", background: bg || PAL.SH, color: color || PAL.T, width: "100%", letterSpacing: 0.3, ...s }}>{children}</button>
));

const SpeakBtn = React.memo(({ text }) => (
  <button type="button" aria-label={`Hear ${text}`} onClick={() => speak(text)} style={{ background: "#FFCC0012", border: `1px solid ${PAL.A}44`, borderRadius: 10, padding: "7px 14px", color: PAL.A, fontSize: 12, cursor: "pointer", marginTop: 8, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
    <Icon name="volume" size={14} /> Hören
  </button>
));

const ProgBar = React.memo(({ pct, color }) => (
  <div style={{ height: 3, background: PAL.B, borderRadius: 2, marginBottom: 18, overflow: "hidden" }}>
    <div style={{
      height: "100%",
      width: `${pct}%`,
      background: color === PAL.R
        ? `linear-gradient(90deg, ${PAL.R}99, ${PAL.R})`
        : `linear-gradient(90deg, ${PAL.AD}, ${PAL.A})`,
      borderRadius: 2,
      transition: "width 0.35s ease-out"
    }} />
  </div>
));

// ── MAIN APP ──
function App() {
  const [screen, setScreen] = useState("home");
  const [mode, setMode] = useState("vocab");
  const [cards, setCards] = useState([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [stats, setStats] = useState({ c: 0, w: 0 });
  const [failed, setFailed] = useState([]);
  const [failedNames, setFailedNames] = useState([]);
  const [rpt, setRpt] = useState(0);
  const [prog, setProg] = useState({});
  const [showEx, setShowEx] = useState(false);
  const [showHint, setShowHint] = useState(false); // NEW: mnemonic hint toggle
  const [vis, setVis] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [setupCat, setSetupCat] = useState(null);
  const [setupMode, setSetupMode] = useState("vocab");
  const [sessLen, setSessLen] = useState(15);
  const [category, setCategory] = useState("");
  const [input, setInput] = useState("");
  const [inputResult, setInputResult] = useState(null);
  const [sel, setSel] = useState(null);
  const [tStart, setTStart] = useState(0);
  const [lastElapsed, setLastElapsed] = useState(0); // NEW: for automaticity display
  // Sentence building
  const [sbPool, setSbPool] = useState([]);
  const [sbPicked, setSbPicked] = useState([]);
  const [sbCorrect, setSbCorrect] = useState(false);
  const [sbChecked, setSbChecked] = useState(false);
  // Verb tense
  const [verbTense, setVerbTense] = useState("present");
  // Imperativ persons (multi-select: which forms to drill)
  const [impPersons, setImpPersons] = useState({ du: true, ihr: true, sie: true });
  // Listening mode: "listen" (tap-to-reveal) or "questions" (comprehension MCQ)
  const [listenMode, setListenMode] = useState("listen");
  // Session difficulty: "mixed" (default), "easy", "hard" — influences card selection order only
  const [sessDiff, setSessDiff] = useState("mixed");
  // Audio mode state
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioPauseLen, setAudioPauseLen] = useState(3500); // ms between utterances
  const [audioEnFirst, setAudioEnFirst] = useState(false); // EN→DE order instead of DE→EN
  const [audioIncludeExample, setAudioIncludeExample] = useState(false);
  // NEW: Dialogue state
  const [dlgIdx, setDlgIdx] = useState(0);
  const [dlgRevealed, setDlgRevealed] = useState({});
  // NEW: Streak + daily stats
  const [dailyStats, setDailyStats] = useState({ date: todayKey(), count: 0, streak: 0 });
  // User-adjustable daily goal (cards/day target). Default 20 preserves behaviour for existing users.
  const [dailyGoal, setDailyGoal] = useState(20);
  // Daily trend stats: { "YYYY-MM-DD": {attempts, correct, totalMs}, ... } — last 60 days
  // Only the FIRST attempt on each card per session is counted (repeats don't reflect real recall).
  const [trendStats, setTrendStats] = useState({});
  const [showTrendBreakdown, setShowTrendBreakdown] = useState(false);
  const [lastSession, setLastSession] = useState(null);
  // Detect whether localStorage actually writes (false in Safari private mode / quota exhausted)
  const [storageOK, setStorageOK] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [importError, setImportError] = useState("");
  const [updateCheckMsg, setUpdateCheckMsg] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingLevel, setOnboardingLevel] = useState("A1");
  const [onboardingGoal, setOnboardingGoal] = useState(20);
  const [onboardingMode, setOnboardingMode] = useState("vocab");
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [offlineReady, setOfflineReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Saved locally");
  // New version of the app is installed and waiting
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const inputRef = useRef(null);
  // Per-session snapshot of prior lastSeen values, keyed by storage key. Lets CardStats
  // show "Last seen Nd ago" without polluting the exportable prog object.
  const priorLastSeenRef = useRef({});
  // Audio-mode playback control. audioTimer = setTimeout id for next step; wakeLockRef
  // holds the Screen Wake Lock so the phone doesn't dim/sleep during playback.
  const audioTimerRef = useRef(null);
  const audioPlayingRef = useRef(false); // mirrors audioPlaying for use inside async callbacks
  const wakeLockRef = useRef(null);
  // Keys of cards already counted toward trend stats this session. Resets on new session start;
  // explicitly NOT reset by startRepeat — repeats must not affect averages.
  const countedKeysRef = useRef(new Set());
  // Listening mode "Play all" — stores timer IDs so we can cancel the chain on re-tap
  const playAllTimersRef = useRef([]);
  // Prevent double-taps from scheduling two "next card" transitions and pushing idx past cards.length.
  const navLockRef = useRef(false);
  const [playAllActive, setPlayAllActive] = useState(false);
  const stopPlayAll = useCallback(() => {
    playAllTimersRef.current.forEach(t => clearTimeout(t));
    playAllTimersRef.current = [];
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setPlayAllActive(false);
  }, []);

  // Load progress + daily stats
  useEffect(() => {
    // Probe write-capability — catches Safari private mode and quota-exhausted states.
    try {
      const probe = "__gfc_probe";
      localStorage.setItem(probe, "1");
      if (localStorage.getItem(probe) !== "1") throw new Error("readback mismatch");
      localStorage.removeItem(probe);
    } catch (e) {
      setStorageOK(false);
    }
    (async () => {
      let hasProgress = false;
      try {
        const r = localStorage.getItem("gfc-v7");
        if (r) { hasProgress = true; setProg(JSON.parse(r)); }
      } catch (e) {}
      try {
        const d = localStorage.getItem("gfc-daily-v7");
        if (d) {
          const parsed = JSON.parse(d);
          const today = todayKey();
          if (parsed.date === today) {
            setDailyStats(parsed);
          } else {
            // New day: carry streak if yesterday was active (count > 0), else reset.
            // Do NOT increment here — record() handles increment when user actually records.
            const yesterday = todayKey(new Date(Date.now() - 86400000));
            const wasActiveYesterday = parsed.date === yesterday && (parsed.count || 0) > 0;
            const newStreak = wasActiveYesterday ? parsed.streak : 0;
            setDailyStats({ date: today, count: 0, streak: newStreak });
          }
        }
      } catch (e) {}
      try {
        const ls = localStorage.getItem("gfc-last-v7");
        if (ls) setLastSession(JSON.parse(ls));
      } catch (e) {}
      try {
        const g = localStorage.getItem("gfc-goal-v7");
        if (g) {
          const parsed = parseInt(g, 10);
          if (Number.isFinite(parsed) && parsed >= 10 && parsed <= 200) setDailyGoal(parsed);
        }
      } catch (e) {}
      try {
        const ts = localStorage.getItem("gfc-stats-v7");
        if (ts) {
          const parsed = JSON.parse(ts);
          if (parsed && typeof parsed === "object") setTrendStats(parsed);
        }
      } catch (e) {}
      try {
        const seenOnboarding = localStorage.getItem("ad-onboarding-v1") === "done";
        if (!seenOnboarding && !hasProgress) setShowOnboarding(true);
      } catch (e) {
        if (!hasProgress) setShowOnboarding(true);
      }
    })();
  }, []);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    const updateOfflineReady = () => setOfflineReady(Boolean(navigator.serviceWorker?.controller || window.__SW_REG__));
    updateOnline();
    updateOfflineReady();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    window.addEventListener("sw-update-available", updateOfflineReady);
    navigator.serviceWorker?.addEventListener?.("controllerchange", updateOfflineReady);
    const t = setInterval(updateOfflineReady, 1500);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener("sw-update-available", updateOfflineReady);
      navigator.serviceWorker?.removeEventListener?.("controllerchange", updateOfflineReady);
      clearInterval(t);
    };
  }, []);

  // Debounce the main progress write — it fires on every card answer and the prog object
  // can grow to ~200KB. Writes less often during active sessions, flushes on page leave.
  const saveTimer = useRef(null);
  const pendingProgRef = useRef(null);
  const save = useCallback(p => {
    pendingProgRef.current = p;
    setSaveStatus("Saving locally...");
    if (saveTimer.current) return; // already scheduled
    saveTimer.current = setTimeout(() => {
      try { localStorage.setItem("gfc-v7", JSON.stringify(pendingProgRef.current)); setSaveStatus("Saved locally"); } catch (e) { setSaveStatus("Storage blocked"); }
      saveTimer.current = null;
      pendingProgRef.current = null;
    }, 400);
  }, []);
  const flushProg = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (pendingProgRef.current) {
      try { localStorage.setItem("gfc-v7", JSON.stringify(pendingProgRef.current)); setSaveStatus("Saved locally"); } catch (e) { setSaveStatus("Storage blocked"); }
      pendingProgRef.current = null;
    }
  }, []);
  const saveDaily = useCallback(d => { try { localStorage.setItem("gfc-daily-v7", JSON.stringify(d)); setSaveStatus("Saved locally"); } catch (e) { setSaveStatus("Storage blocked"); } }, []);
  const saveLast = useCallback(ls => { try { localStorage.setItem("gfc-last-v7", JSON.stringify(ls)); } catch (e) {} }, []);

  // Update the daily goal and persist immediately. Clamped to [10, 200] range.
  const updateDailyGoal = useCallback(n => {
    const clamped = Math.max(10, Math.min(200, Math.round(n)));
    setDailyGoal(clamped);
    try { localStorage.setItem("gfc-goal-v7", String(clamped)); } catch (e) {}
  }, []);

  // Persist trend stats (keyed by date string). Caller prunes to 60 days before passing.
  const saveTrend = useCallback(t => {
    try { localStorage.setItem("gfc-stats-v7", JSON.stringify(t)); } catch (e) {}
  }, []);

  // Audio mode: lightweight daily-goal counter (does NOT touch SRS — audio is passive exposure)
  const recordAudioHeard = useCallback(() => {
    const today = todayKey();
    setDailyStats(prev => {
      let d;
      if (prev.date === today) {
        const firstCardOfDay = prev.count === 0;
        d = { ...prev, count: prev.count + 1, streak: firstCardOfDay ? prev.streak + 1 : prev.streak };
      } else {
        d = { date: today, count: 1, streak: prev.streak + 1 };
      }
      saveDaily(d);
      return d;
    });
  }, [saveDaily]);

  // Screen Wake Lock: keeps the screen on during audio playback.
  // iOS 16.4+ and modern Android support it; older browsers silently no-op.
  const acquireWakeLock = useCallback(async () => {
    if (!navigator.wakeLock) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch (e) { /* denied or unsupported — not fatal */ }
  }, []);
  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      try { wakeLockRef.current.release(); } catch (e) {}
      wakeLockRef.current = null;
    }
  }, []);

  // Pause-aware timeout. Resolves after `ms` unless playback is paused/stopped.
  const pauseAwareDelay = useCallback((ms) => {
    return new Promise(resolve => {
      audioTimerRef.current = setTimeout(() => {
        audioTimerRef.current = null;
        resolve();
      }, ms);
    });
  }, []);

  // Play through one card: speak primary → pause → speak secondary → pause → advance
  const playOneCard = useCallback(async (card) => {
    if (!audioPlayingRef.current) return;
    const de = audioIncludeExample && card.ex ? `${card.de}. ${card.ex}` : card.de;
    const en = card.en;
    const firstText = audioEnFirst ? en : de;
    const firstLang = audioEnFirst ? "en-US" : "de-DE";
    const secondText = audioEnFirst ? de : en;
    const secondLang = audioEnFirst ? "de-DE" : "en-US";
    await speakWith(firstText, firstLang, 0.85);
    if (!audioPlayingRef.current) return;
    await pauseAwareDelay(audioPauseLen);
    if (!audioPlayingRef.current) return;
    await speakWith(secondText, secondLang, 0.9);
    if (!audioPlayingRef.current) return;
    await pauseAwareDelay(audioPauseLen);
  }, [audioEnFirst, audioIncludeExample, audioPauseLen, pauseAwareDelay]);

  // Pause playback cleanly — cancel current utterance and any pending timer
  const audioPause = useCallback(() => {
    audioPlayingRef.current = false;
    setAudioPlaying(false);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (audioTimerRef.current) { clearTimeout(audioTimerRef.current); audioTimerRef.current = null; }
    releaseWakeLock();
  }, [releaseWakeLock]);

  // Exit audio mode fully (pause + cleanup)
  const audioExit = useCallback(() => {
    audioPause();
    setScreen("home");
  }, [audioPause]);

  // Resume playback from current position
  const audioResume = useCallback(async () => {
    audioPlayingRef.current = true;
    setAudioPlaying(true);
    await acquireWakeLock();
  }, [acquireWakeLock]);

  // Flush pending progress on tab hide / page unload — protects against data loss
  // if the user closes the browser or backgrounds the PWA mid-debounce.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") flushProg(); };
    window.addEventListener("beforeunload", flushProg);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", flushProg);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flushProg]);

  // Export all progress as a downloadable JSON file
  const exportData = useCallback(() => {
    const payload = {
      app: "AutoDeutsch",
      schemaVersion: "v7",
      exportedAt: new Date().toISOString(),
      prog, dailyStats, lastSession, dailyGoal, trendStats,
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `autodeutsch-${todayKey()}.json`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    } catch (e) {
      setImportError("Export failed: " + (e.message || "unknown error"));
    }
  }, [prog, dailyStats, lastSession, dailyGoal, trendStats]);

  // Import progress from a user-selected JSON file; merges by keeping the higher box / attempts
  const importData = useCallback((file) => {
    setImportError("");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== "object" || !data.prog) throw new Error("Not an AutoDeutsch backup");
        if (data.schemaVersion && data.schemaVersion !== "v7") throw new Error(`Unsupported schema: ${data.schemaVersion}`);
        // Merge rule: for each key, keep whichever entry has more attempts (more learning history)
        const merged = { ...prog };
        Object.entries(data.prog).forEach(([k, v]) => {
          const incoming = normalizeEntry(v);
          const existing = merged[k] ? normalizeEntry(merged[k]) : null;
          if (!existing || incoming.stats.attempts > existing.stats.attempts) merged[k] = v;
        });
        setProg(merged); save(merged); flushProg();
        if (data.dailyStats && data.dailyStats.date) {
          // Adopt the higher streak, keep today's count
          const today = todayKey();
          const keepCount = dailyStats.date === today ? dailyStats.count : 0;
          const newStreak = Math.max(dailyStats.streak || 0, data.dailyStats.streak || 0);
          const d = { date: today, count: keepCount, streak: newStreak };
          setDailyStats(d); saveDaily(d);
        }
        if (data.lastSession) { setLastSession(data.lastSession); saveLast(data.lastSession); }
        if (typeof data.dailyGoal === "number" && data.dailyGoal >= 10 && data.dailyGoal <= 200) {
          updateDailyGoal(data.dailyGoal);
        }
        if (data.trendStats && typeof data.trendStats === "object") {
          // Merge per-day: keep whichever record has more attempts (richer history).
          // Then prune the union to last 60 days.
          const merged = { ...trendStats };
          Object.entries(data.trendStats).forEach(([day, incoming]) => {
            if (!incoming || typeof incoming !== "object") return;
            const existing = merged[day];
            if (!existing || (incoming.attempts || 0) > (existing.attempts || 0)) merged[day] = incoming;
          });
          const cutoff = Date.now() - 60 * 86400000;
          const pruned = {};
          Object.entries(merged).forEach(([k, v]) => {
            if (new Date(k).getTime() >= cutoff) pruned[k] = v;
          });
          setTrendStats(pruned); saveTrend(pruned);
        }
        setImportError("✓ Imported successfully");
      } catch (e) {
        setImportError("Import failed: " + (e.message || "invalid file"));
      }
    };
    reader.onerror = () => setImportError("Could not read file");
    reader.readAsText(file);
  }, [prog, dailyStats, save, saveDaily, saveLast, flushProg, updateDailyGoal, trendStats, saveTrend]);

  // Warm up TTS voices — on iOS Safari, getVoices() returns [] until loaded asynchronously.
  // Without this, the first utterance of a cold session often uses the default (English) voice.
  useEffect(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    const onVoices = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", onVoices);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", onVoices);
  }, []);

  // Esc key closes any open modal — matches hardware-keyboard expectations (e.g. iPad users)
  useEffect(() => {
    if (!showSetup && !showSettings) return;
    const onKey = e => {
      if (e.key === "Escape") {
        if (showSettings) setShowSettings(false);
        else if (showSetup) setShowSetup(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSetup, showSettings]);

  // Stop audio playback when leaving the audio screen (e.g. app reload, nav to another mode)
  useEffect(() => {
    if (screen !== "audio" && audioPlayingRef.current) {
      audioPlayingRef.current = false;
      setAudioPlaying(false);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (audioTimerRef.current) { clearTimeout(audioTimerRef.current); audioTimerRef.current = null; }
      if (wakeLockRef.current) { try { wakeLockRef.current.release(); } catch (e) {} wakeLockRef.current = null; }
    }
    // Also stop any active "Play all" dialogue chain
    if (screen !== "drill" && playAllTimersRef.current.length > 0) {
      stopPlayAll();
    }
  }, [screen, stopPlayAll]);

  // Listen for "update available" dispatched from the SW registration script
  useEffect(() => {
    const onUpdate = () => setUpdateAvailable(true);
    window.addEventListener("sw-update-available", onUpdate);
    return () => window.removeEventListener("sw-update-available", onUpdate);
  }, []);

  // Audio mode driver — runs whenever audioPlaying flips true.
  // Plays current card, on completion increments dailyGoal + advances to next.
  // Auto-stops at end of queue.
  useEffect(() => {
    if (!audioPlaying) return;
    audioPlayingRef.current = true;
    let cancelled = false;
    (async () => {
      while (!cancelled && audioPlayingRef.current) {
        const current = cards[idx];
        if (!current) { audioPause(); break; }
        await playOneCard(current);
        if (cancelled || !audioPlayingRef.current) break;
        recordAudioHeard();
        // advance
        if (idx + 1 >= cards.length) {
          audioPause();
          setScreen("results");
          // minimal stats for results screen
          setStats(s => ({ c: cards.length, w: 0 }));
          break;
        }
        setIdx(i => i + 1);
        // yield a tick so state update commits before next iteration sees new idx
        await new Promise(r => setTimeout(r, 50));
      }
    })();
    return () => { cancelled = true; };
  }, [audioPlaying, idx, cards, playOneCard, recordAudioHeard, audioPause]);

  // Re-acquire wake-lock if it's lost when the page becomes visible again (iOS behaviour)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && audioPlaying && !wakeLockRef.current) {
        acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [audioPlaying, acquireWakeLock]);

  const applyUpdate = useCallback(() => {
    const waiting = window.__SW_WAITING__;
    if (waiting) waiting.postMessage({ type: "SKIP_WAITING" });
    else window.location.reload();
  }, []);

  const nouns = useMemo(getNouns, []);
  const totalW = useMemo(() => Object.values(V).flat().length, []);
  const totalL = useMemo(
    () => Object.values(prog).filter(p => normalizeEntry(p).srs.box >= 3).length,
    [prog]
  );

  // Leech detection: failed 4+ times and box < 3
  const leeches = useMemo(() => {
    return Object.entries(prog).filter(([k, v]) => {
      const n = normalizeEntry(v);
      return n.stats.incorrect >= 4 && n.srs.box < 3;
    }).map(([k, v]) => ({ key: k, ...normalizeEntry(v) }));
  }, [prog]);

  // Weak cards: leeches + low-box cards + slow-response cards
  const weakCards = useMemo(() => {
    const weak = new Set();
    Object.entries(prog).forEach(([k, v]) => {
      const n = normalizeEntry(v);
      if (n.stats.incorrect >= 4 && n.srs.box < 3) weak.add(k);
      if (n.srs.box <= 2 && n.stats.attempts >= 2) weak.add(k);
      if (n.stats.avgTime > 15000 && n.stats.attempts >= 2) weak.add(k);
    });
    return weak;
  }, [prog]);

  // SRS interval schedule — days after lastReviewed until a card is due again.
  // Box 0 = seen-but-not-learned (review daily until it graduates).
  // Box 5 = mastered (review monthly to keep it fresh).
  const SRS_INTERVALS = [1, 2, 4, 7, 14, 30];

  // Cards that are due for review based on SRS box + lastReviewed timestamp.
  // Only considers resolvable keys (vocab/production/cloze/imperativ — same subset as weak areas).
  const dueCards = useMemo(() => {
    const due = new Set();
    const now = Date.now();
    Object.entries(prog).forEach(([k, v]) => {
      const n = normalizeEntry(v);
      if (n.stats.attempts < 1) return;
      const box = Math.max(0, Math.min(5, Math.floor(n.srs.box)));
      const intervalMs = SRS_INTERVALS[box] * 86400000;
      const lastRev = n.srs.lastReviewed || n.stats.lastSeen || 0;
      if (!lastRev || (now - lastRev) >= intervalMs) due.add(k);
    });
    return due;
  }, [prog]);

  const gk = (card, cat, m) => `${m}::${card._cat || card.cat || cat}::${cardId(card)}`;

  const record = (correct, card, elapsed) => {
    const key = gk(card, category, mode);
    const prev = normalizeEntry(prog[key]);
    const now = Date.now();
    // Snapshot prior lastSeen for CardStats display (separate from prog to keep exports clean)
    if (prev.stats.lastSeen) priorLastSeenRef.current[key] = prev.stats.lastSeen;

    let boxDelta = correct ? 1 : -1;
    if (correct && elapsed > 15000) boxDelta = 0;
    else if (correct && elapsed > 8000) boxDelta = 0.5;

    const attempts = prev.stats.attempts + 1;
    const rollingAvg = prev.stats.attempts > 0
      ? (prev.stats.avgTime * prev.stats.attempts + elapsed) / attempts
      : elapsed;

    const upd = {
      ...prog,
      [key]: {
        stats: {
          attempts,
          correct: prev.stats.correct + (correct ? 1 : 0),
          incorrect: prev.stats.incorrect + (correct ? 0 : 1),
          lastSeen: now,
          avgTime: Math.round(rollingAvg),
        },
        srs: {
          box: Math.max(0, Math.min(5, prev.srs.box + boxDelta)),
          lastReviewed: now,
        },
      },
    };
    setProg(upd); save(upd);
    setStats(s => ({ c: s.c + (correct ? 1 : 0), w: s.w + (correct ? 0 : 1) }));
    if (!correct) { setFailed(f => [...f, card]); setFailedNames(f => [...f, card.de || card.q || card.verb || (card.article && card.noun ? `${card.article} ${card.noun}` : null) || (card.correct && card.correct.join(' ')) || '?']); }
    setLastElapsed(elapsed);
    // NEW: Update daily stats
    const today = todayKey();
    setDailyStats(prev => {
      let d;
      if (prev.date === today) {
        // Same day — streak already advanced on first card; just increment count
        const firstCardOfDay = prev.count === 0;
        d = { ...prev, count: prev.count + 1, streak: firstCardOfDay ? prev.streak + 1 : prev.streak };
      } else {
        // First activity on a new day (load effect didn't run, rare)
        d = { date: today, count: 1, streak: prev.streak + 1 };
      }
      saveDaily(d);
      return d;
    });
    // Trend stats — count only the FIRST attempt on each card this session.
    // Repeats (including "Repeat failed" on results) must not influence averages.
    if (!countedKeysRef.current.has(key)) {
      countedKeysRef.current.add(key);
      // Cap per-card time at 60s to exclude outliers (phone put down mid-card)
      const cappedMs = Math.min(elapsed || 0, 60000);
      setTrendStats(prev => {
        const day = prev[today] || { attempts: 0, correct: 0, totalMs: 0 };
        const updated = {
          ...prev,
          [today]: {
            attempts: day.attempts + 1,
            correct: day.correct + (correct ? 1 : 0),
            totalMs: day.totalMs + cappedMs,
          },
        };
        // Prune to last 60 days
        const cutoff = Date.now() - 60 * 86400000;
        const pruned = {};
        Object.entries(updated).forEach(([k, v]) => {
          if (new Date(k).getTime() >= cutoff) pruned[k] = v;
        });
        saveTrend(pruned);
        return pruned;
      });
    }
  };

  // Resolve a progress key back into a card object of the appropriate mode.
  // Returns a card tagged with _mode so the caller knows which screen to route to.
  const resolveKey = (key) => {
    const parts = key.split("::");
    const m = parts[0];
    if (m === "vocab" || m === "production") {
      const cat = parts[1], de = parts.slice(2).join("::");
      const found = V[cat]?.find(w => w && w.de === de);
      if (found) return { ...found, _cat: cat, _mode: m };
    }
    if (m === "article") {
      const cat = parts[1], id = parts.slice(2).join("::");
      const found = nouns.find(n => n.cat === cat && `${n.article} ${n.noun}` === id);
      if (found) return { ...found, _cat: cat, _mode: m };
    }
    if (m === "cloze") {
      // cloze keys look like "cloze::Grammar Cloze::<q>"; q may contain "::" so re-join
      const q = parts.slice(2).join("::");
      const found = CLOZE.find(c => c.q === q);
      if (found) return { ...found, _mode: m };
    }
    if (m === "imperativ") {
      // imperativ keys: "imperativ::<category>::<base>::<person>" (e.g. imperativ::Imperative::geben::du)
      const base = parts[2], person = parts[3];
      const found = IMPERATIVES.find(i => i.base === base);
      if (found && person) return { ...found, _person: person, de: `${base}::${person}`, _mode: m };
    }
    return null;
  };

  // Weak cards grouped by resolvable mode. Only these will actually be reviewed.
  const resolvedWeak = useMemo(() => {
    const byMode = {};
    let total = 0;
    [...weakCards].forEach(k => {
      const card = resolveKey(k);
      if (!card) return;
      (byMode[card._mode] = byMode[card._mode] || []).push(card);
      total++;
    });
    return { byMode, total };
  }, [weakCards]);

  // Resolved + grouped "due today" queue (same resolution rules as weak areas)
  const resolvedDue = useMemo(() => {
    const byMode = {};
    let total = 0;
    [...dueCards].forEach(k => {
      const card = resolveKey(k);
      if (!card) return;
      (byMode[card._mode] = byMode[card._mode] || []).push(card);
      total++;
    });
    return { byMode, total };
  }, [dueCards]);

  const almostCards = useMemo(() => {
    const byMode = {};
    let total = 0;
    Object.entries(prog).forEach(([k, v]) => {
      const n = normalizeEntry(v);
      if (n.srs.box < 4 || n.srs.box >= 5) return;
      const card = resolveKey(k);
      if (!card) return;
      (byMode[card._mode] = byMode[card._mode] || []).push(card);
      total++;
    });
    return { byMode, total };
  }, [prog]);

  // 30-day trend summary derived from trendStats. Used by the home Progress section.
  // Output: { days: [{date, attempts, correct, totalMs}, ...30 items, oldest→newest],
  //           totalAttempts, totalCorrect, totalMs, accuracy (0-100), avgSec }
  const trend30 = useMemo(() => {
    const days = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = todayKey(d);
      const entry = trendStats[key] || { attempts: 0, correct: 0, totalMs: 0 };
      days.push({ date: key, ...entry });
    }
    const totals = days.reduce((a, d) => ({
      attempts: a.attempts + d.attempts,
      correct: a.correct + d.correct,
      totalMs: a.totalMs + d.totalMs,
    }), { attempts: 0, correct: 0, totalMs: 0 });
    return {
      days,
      totalAttempts: totals.attempts,
      totalCorrect: totals.correct,
      totalMs: totals.totalMs,
      accuracy: totals.attempts >= 3 ? Math.round((totals.correct / totals.attempts) * 100) : null,
      avgSec: totals.attempts >= 3 ? (totals.totalMs / totals.attempts / 1000) : null,
    };
  }, [trendStats]);

  const openSetup = (cat, dm) => {
    setSetupCat(cat);
    setSetupMode(dm || "vocab");
    const mx = cat === "__all__" ? totalW : cat === "__grammar__" ? CLOZE.length : cat === "__verb__" ? 30 : cat === "__sentence__" ? SENTENCES.length : cat === "__imperativ__" ? IMPERATIVES.length : cat === "__listening__" ? DIALOGUES.length : cat === "__weak__" ? Math.max(weakCards.size, 1) : (V[cat]?.length || 25);
    setSessLen(Math.min(15, mx));
    setShowSetup(true);
  };

  const finishOnboarding = () => {
    updateDailyGoal(onboardingGoal);
    setSetupMode(onboardingMode);
    setSessDiff(onboardingLevel === "B1" ? "hard" : "mixed");
    setShowOnboarding(false);
    try {
      localStorage.setItem("ad-onboarding-v1", "done");
      localStorage.setItem("ad-onboarding-pref-v1", JSON.stringify({
        level: onboardingLevel,
        dailyGoal: onboardingGoal,
        preferredMode: onboardingMode,
        completedAt: new Date().toISOString(),
      }));
    } catch (e) {}
  };

  const resetSessionState = () => {
    navLockRef.current = false;
    setStats({ c: 0, w: 0 }); setFailed([]); setFailedNames([]); setRpt(0); setIdx(0);
    setFlipped(false); setAnswered(false); setSel(null); setShowEx(false); setShowHint(false);
    setVis(true); setInput(""); setInputResult(null); setLastElapsed(0);
    // Fresh session → clear first-attempt tracker so stats record this run's first attempts.
    // startRepeat deliberately does NOT call this, so repeated failures stay excluded.
    countedKeysRef.current = new Set();
    setSbPool([]); setSbPicked([]); setSbChecked(false); setSbCorrect(false);
  };

  const startSession = (cat, m, count) => {
    setMode(m); setShowSetup(false); resetSessionState();
    // Remember this session for one-tap resume
    const label = cat === "__all__" ? "All Categories" : cat === "__grammar__" ? "Grammar Cloze" : cat === "__verb__" ? "Verb Trainer" : cat === "__sentence__" ? "Sentence Builder" : cat === "__imperativ__" ? "Imperative" : cat === "__listening__" ? "Listening Practice" : cat;
    const ls = { cat, m, count, label, ts: Date.now() };
    setLastSession(ls); saveLast(ls);

    if (m === "vocab" || m === "production") {
      const isAll = cat === "__all__";
      setCategory(isAll ? "All Categories" : cat);
      const pool = isAll ? Object.entries(V).flatMap(([c, ws]) => ws.map(w => ({ ...w, _cat: c }))) : V[cat].map(w => ({ ...w, _cat: cat }));
      const getMult = c => sessionMultiplier(prog[`${m}::${c._cat}::${c.de}`], sessDiff);
      setCards(weightedSelect(pool, count, getMult)); setScreen("cards"); setTStart(Date.now());
    } else if (m === "article") {
      setCategory("Article Drill"); const pool = cat === "__all__" ? nouns : nouns.filter(n => n.cat === cat);
      setCards(sh(pool).slice(0, Math.min(count, pool.length))); setScreen("drill"); setTStart(Date.now());
    } else if (m === "cloze") {
      setCategory("Grammar Cloze"); setCards(sh([...CLOZE]).slice(0, Math.min(count, CLOZE.length)));
      setScreen("drill"); setTStart(Date.now());
    } else if (m === "verb") {
      setCategory("Verb Trainer"); setCards(Array.from({ length: count }, () => makeVerbQ(verbTense)));
      setScreen("drill"); setTStart(Date.now());
    } else if (m === "sentence") {
      setCategory("Sentence Builder");
      const pool = sh([...SENTENCES]).slice(0, Math.min(count, SENTENCES.length));
      setCards(pool); setScreen("sentence");
      const first = pool[0]; setSbPool(sh([...first.correct])); setSbPicked([]); setSbChecked(false); setSbCorrect(false);
      setTStart(Date.now());
    } else if (m === "imperativ") {
      setCategory("Imperative");
      // Build one card per (imperative × selected person)
      const persons = Object.entries(impPersons).filter(([k, v]) => v).map(([k]) => k);
      const selected = persons.length > 0 ? persons : ["du", "ihr", "sie"];
      // Expand: each IMPERATIVES row becomes one card per chosen person
      const pool = sh([...IMPERATIVES]).flatMap(card => selected.map(p => ({ ...card, _person: p, de: `${card.base}::${p}` })));
      setCards(pool.slice(0, count));
      setScreen("drill"); setTStart(Date.now());
    } else if (m === "listening") {
      setCategory(listenMode === "questions" ? "Listening + Questions" : "Listening Practice");
      if (listenMode === "listen") {
        // Tap-through mode: use existing dialogues screen
        const pool = sh([...DIALOGUES]).slice(0, count);
        setCards(pool); setDlgIdx(0); setDlgRevealed({});
        setScreen("dialogues"); setTStart(Date.now());
      } else {
        // Questions mode: flatten to one card per question, only dialogues that have questions
        const withQ = DIALOGUES.filter(d => d.questions && d.questions.length);
        const shuffled = sh([...withQ]);
        const expanded = shuffled.flatMap(d => d.questions.map((q, qi) => ({
          _dialogue: d, _qIdx: qi, q: q.q, opts: q.opts, correctIdx: q.correctIdx,
          de: `${d.title}::${qi}`,
        })));
        setCards(expanded.slice(0, count));
        setScreen("drill"); setTStart(Date.now());
      }
    } else if (m === "audio") {
      // Audio mode: same pool construction as vocab, but play instead of quiz.
      // Does NOT touch SRS. Counts toward daily goal only.
      const isAll = cat === "__all__";
      setCategory(isAll ? "All Categories (Audio)" : `${cat} (Audio)`);
      const pool = isAll ? Object.entries(V).flatMap(([c, ws]) => ws.map(w => ({ ...w, _cat: c }))) : V[cat].map(w => ({ ...w, _cat: cat }));
      const getMult = c => sessionMultiplier(prog[`vocab::${c._cat}::${c.de}`], sessDiff);
      const selected = weightedSelect(pool, count, getMult);
      setCards(selected);
      setIdx(0);
      setScreen("audio"); setTStart(Date.now());
      // Auto-start playback after screen mounts so user lands in "playing" state
      setTimeout(() => { audioPlayingRef.current = true; setAudioPlaying(true); acquireWakeLock(); }, 100);
    }
  };

  // Launch weak review. Weak cards span multiple modes (vocab, cloze, imperativ, etc.)
  // but each mode has its own screen. Strategy: pick the largest mode bucket from the
  // pre-grouped memo and review those cards on the matching screen.
  const startWeakReview = () => {
    if (resolvedWeak.total === 0) return;
    const buckets = resolvedWeak.byMode;
    const largestMode = Object.keys(buckets).sort((a, b) => buckets[b].length - buckets[a].length)[0];
    const pool = buckets[largestMode];
    resetSessionState();
    const picked = sh(pool).slice(0, Math.min(20, pool.length));
    setCards(picked);
    if (largestMode === "vocab" || largestMode === "production") {
      setMode(largestMode); setCategory("Weak Areas"); setScreen("cards");
    } else if (largestMode === "article") {
      setMode("article"); setCategory("Article Drill"); setScreen("drill");
    } else if (largestMode === "cloze") {
      setMode("cloze"); setCategory("Grammar Cloze"); setScreen("drill");
    } else if (largestMode === "imperativ") {
      setMode("imperativ"); setCategory("Imperative"); setScreen("drill");
    } else {
      setMode("vocab"); setCategory("Weak Areas"); setScreen("cards");
    }
    setTStart(Date.now());
  };

  // Launch Daily Review — SRS-scheduled cards that are due today.
  // Same routing logic as weak review: pick largest mode bucket, route to matching screen.
  const startDueReview = () => {
    if (resolvedDue.total === 0) return;
    const buckets = resolvedDue.byMode;
    const largestMode = Object.keys(buckets).sort((a, b) => buckets[b].length - buckets[a].length)[0];
    const pool = buckets[largestMode];
    resetSessionState();
    const picked = sh(pool).slice(0, Math.min(25, pool.length));
    setCards(picked);
    if (largestMode === "vocab" || largestMode === "production") {
      setMode(largestMode); setCategory("Today's Review"); setScreen("cards");
    } else if (largestMode === "article") {
      setMode("article"); setCategory("Article Drill"); setScreen("drill");
    } else if (largestMode === "cloze") {
      setMode("cloze"); setCategory("Grammar Cloze"); setScreen("drill");
    } else if (largestMode === "imperativ") {
      setMode("imperativ"); setCategory("Imperative"); setScreen("drill");
    } else {
      setMode("vocab"); setCategory("Today's Review"); setScreen("cards");
    }
    setTStart(Date.now());
  };

  const startAlmostReview = () => {
    if (almostCards.total === 0) return;
    const buckets = almostCards.byMode;
    const largestMode = Object.keys(buckets).sort((a, b) => buckets[b].length - buckets[a].length)[0];
    const pool = buckets[largestMode];
    resetSessionState();
    const picked = sh(pool).slice(0, Math.min(15, pool.length));
    setCards(picked);
    if (largestMode === "vocab" || largestMode === "production") {
      setMode(largestMode); setCategory("Almost Mastered"); setScreen("cards");
    } else if (largestMode === "article") {
      setMode("article"); setCategory("Article Drill"); setScreen("drill");
    } else if (largestMode === "cloze") {
      setMode("cloze"); setCategory("Grammar Cloze"); setScreen("drill");
    } else if (largestMode === "imperativ") {
      setMode("imperativ"); setCategory("Imperative"); setScreen("drill");
    } else {
      setMode("vocab"); setCategory("Almost Mastered"); setScreen("cards");
    }
    setTStart(Date.now());
  };

  const startRepeat = () => {
    const m = mode;
    if (m === "verb") setCards(Array.from({ length: failed.length }, () => makeVerbQ(verbTense)));
    else if (m === "sentence") {
      setCards(sh([...failed]));
      const f = failed[0];
      if (f) { setSbPool(sh([...f.correct])); setSbPicked([]); setSbChecked(false); setSbCorrect(false); }
    } else setCards(sh([...failed]));
    setIdx(0); setFlipped(false); setAnswered(false); setSel(null); setShowEx(false); setShowHint(false);
    setVis(true); setInput(""); setInputResult(null); setLastElapsed(0);
    setStats({ c: 0, w: 0 }); setFailed([]); setFailedNames([]); setRpt(r => r + 1); setTStart(Date.now());
    setScreen(m === "sentence" ? "sentence" : (m === "vocab" || m === "production") ? "cards" : "drill");
  };

  // Card flip handlers
  const handleFlipAnswer = (correct) => { if (answered) return; setAnswered(true); record(correct, cards[idx], Date.now() - tStart); };
  const revealCard = () => {
    if (!flipped && vis) {
      setFlipped(true);
      if (cards[idx]?.de) speak(cards[idx].de);
    }
  };
  const handleRevealKey = e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      revealCard();
    }
  };
  const submitTyped = () => {
    if (answered) return;
    const card = cards[idx]; const target = mode === "production" ? card.de : card.en;
    const result = checkMatch(input, target);
    setInputResult(result); setAnswered(true);
    record(result !== "wrong", card, Date.now() - tStart);
    speak(card.de);
  };
  const submitCloze = () => {
    if (answered) return;
    const card = cards[idx]; const result = checkMatch(input, card.a);
    setInputResult(result); setAnswered(true);
    record(result !== "wrong", card, Date.now() - tStart);
  };

  const nextCard = () => {
    if (navLockRef.current) return;
    if (idx >= cards.length - 1) { setScreen("results"); return; }
    navLockRef.current = true;
    setVis(false);
    setTimeout(() => {
      setFlipped(false); setAnswered(false); setShowEx(false); setShowHint(false); setInput(""); setInputResult(null); setLastElapsed(0);
      setIdx(i => Math.min(i + 1, Math.max(cards.length - 1, 0)));
      setTStart(Date.now());
      setTimeout(() => { setVis(true); navLockRef.current = false; }, 50);
    }, 180);
  };

  const handleDrillAnswer = (oi) => {
    if (answered) return; setAnswered(true); setSel(oi);
    const card = cards[idx]; let correct;
    if (mode === "article") correct = ["der", "die", "das"][oi] === card.article;
    else if (mode === "verb") correct = oi === card.correctIdx;
    else if (mode === "listening") correct = oi === card.correctIdx;
    else correct = false;
    record(correct, card, Date.now() - tStart);
    // Only speak when there's something meaningful to say. In verb mode the full
    // "pron + conjugation" is the natural utterance. Other modes don't emit speech here.
    if (mode === "verb" && card.pron && card.correct) speak(`${card.pron} ${card.correct}`);
  };

  const nextDrill = () => {
    if (navLockRef.current) return;
    if (idx >= cards.length - 1) { setScreen("results"); return; }
    navLockRef.current = true;
    setVis(false);
    setTimeout(() => {
      setAnswered(false); setSel(null); setInput(""); setInputResult(null); setShowHint(false); setLastElapsed(0);
      setIdx(i => Math.min(i + 1, Math.max(cards.length - 1, 0)));
      setTStart(Date.now());
      setTimeout(() => { setVis(true); navLockRef.current = false; }, 50);
    }, 180);
  };

  // Sentence building
  const sbTapWord = (word, i) => { if (sbChecked) return; const np = [...sbPool]; np.splice(i, 1); setSbPool(np); setSbPicked(p => [...p, word]); };
  const sbUntapWord = (word, i) => { if (sbChecked) return; const np = [...sbPicked]; np.splice(i, 1); setSbPicked(np); setSbPool(p => [...p, word]); };
  const sbCheck = () => { const card = cards[idx]; const isCorrect = sbPicked.join(" ") === card.correct.join(" "); setSbChecked(true); setSbCorrect(isCorrect); record(isCorrect, card, Date.now() - tStart); };
  const sbNext = () => {
    if (navLockRef.current) return;
    if (idx >= cards.length - 1) { setScreen("results"); return; }
    navLockRef.current = true;
    setVis(false);
    setTimeout(() => {
      const next = cards[Math.min(idx + 1, cards.length - 1)];
      if (next) setSbPool(sh([...next.correct]));
      setSbPicked([]); setSbChecked(false); setSbCorrect(false); setLastElapsed(0);
      setIdx(i => Math.min(i + 1, Math.max(cards.length - 1, 0)));
      setTStart(Date.now());
      setTimeout(() => { setVis(true); navLockRef.current = false; }, 50);
    }, 180);
  };

  // Precompute all category stats in one pass — avoids 19×N recomputation on every render.
  const catStats = useMemo(() => {
    const out = {};
    CATS.forEach(cat => {
      const ws = V[cat]; let seen = 0;
      ws.forEach(w => {
        if (!w?.de) return;
        const vk = `vocab::${cat}::${w.de}`, pk = `production::${cat}::${w.de}`;
        if ((prog[vk] && normalizeEntry(prog[vk]).stats.attempts > 0) ||
            (prog[pk] && normalizeEntry(prog[pk]).stats.attempts > 0)) seen++;
      });
      out[cat] = { total: ws.length, seen };
    });
    return out;
  }, [prog]);
  const getCatStats = cat => catStats[cat] || { total: 0, seen: 0 };

  // Progress summaries per training mode. "Seen" counts an item as completed when
  // any attempt has scored correct >= 1, matching the brief's simple completion rule.
  // Denominators are chosen to be meaningful, not the full key-space:
  //   - Cloze: each CLOZE entry uniquely identified by its question
  //   - Sentence: each SENTENCES entry by its .correct joined
  //   - Imperative: unique .base verbs (ignoring which person was asked)
  //   - Verb Trainer: unique verbs the user has gotten right in any pronoun/tense
  //   - Listening: unique dialogue titles
  //   - Article drill is omitted because cards don't carry a stable id yet
  const trainingStats = useMemo(() => {
    const out = {
      article: { total: nouns.length, seen: 0 },
      cloze: { total: CLOZE.length, seen: 0 },
      sentence: { total: SENTENCES.length, seen: 0 },
      imperativ: { total: IMPERATIVES.length, seen: 0 },
      verb: { total: VERBS.length, seen: 0 },
      listening: { total: DIALOGUES.length, seen: 0 },
    };
    // Unique-identifier sets so we count each underlying item only once
    const seenArticle = new Set(), seenCloze = new Set(), seenSent = new Set(), seenImp = new Set(), seenVerb = new Set(), seenDlg = new Set();
    for (const [key, raw] of Object.entries(prog)) {
      const n = normalizeEntry(raw);
      if (n.stats.correct < 1) continue;
      const parts = key.split("::");
      if (parts.length < 3) continue;
      const [m, cat, id] = [parts[0], parts[1], parts.slice(2).join("::")];
      if (m === "article") seenArticle.add(`${cat}::${id}`);
      else if (m === "cloze") seenCloze.add(id);
      else if (m === "sentence") seenSent.add(id);
      else if (m === "imperativ") {
        // id is "{base}::{person}" — strip ::person to get unique base
        const base = id.split("::")[0];
        seenImp.add(base);
      } else if (m === "verb") {
        // id is "{verb}-{pron}-{tense}" — strip to verb stem
        const verb = id.split("-")[0];
        seenVerb.add(verb);
      } else if (m === "listening") seenDlg.add(id);
    }
    out.article.seen = seenArticle.size;
    out.cloze.seen = seenCloze.size;
    out.sentence.seen = seenSent.size;
    out.imperativ.seen = seenImp.size;
    out.verb.seen = seenVerb.size;
    out.listening.seen = seenDlg.size;
    return out;
  }, [prog, nouns]);

  const card = cards[idx];
  const sessionScreens = new Set(["cards", "drill", "sentence", "audio"]);
  const activeCardMissing = sessionScreens.has(screen) && cards.length > 0 && !card;
  const cardBox = card ? normalizeEntry(prog[gk(card, category, mode)]).srs.box : 0;

  useEffect(() => {
    if (!activeCardMissing) return;
    navLockRef.current = false;
    const t = setTimeout(() => {
      setScreen("results");
      setIdx(i => Math.min(i, Math.max(cards.length - 1, 0)));
    }, 0);
    return () => clearTimeout(t);
  }, [activeCardMissing, cards.length]);

  // Styles
  const A = "#FFCC00", AD = "#CC9900", BG = "#0A0A0A", S = "#111111", SH = "#1A1A1A", B = "#2A2A2A";
  const G = "#4ADE80", R = "#DD0000", T = "#F0EDE5", TD = "#8A857D", BL = "#60A5FA";
  const dailyGoalPct = Math.min(1, dailyStats.count / Math.max(dailyGoal, 1));
  const FN = `'Montserrat',sans-serif`, BD = `'Montserrat',sans-serif`;
  const FGRAD = "linear-gradient(145deg, #111 0%, #1A0808 50%, #1A1400 100%)";
  const FGRAD2 = "linear-gradient(145deg, #0A0A0A 0%, #180808 60%, #181200 100%)";
  const FLAG = `linear-gradient(90deg, #050505 0 33%, ${R} 33% 66%, ${A} 66%)`;
  const SOFT_PANEL = "linear-gradient(180deg, #171717 0%, #101010 100%)";
  const categoryIcons = { "Greetings & Basics": "message", "Numbers & Time": "clock", "Family & People": "users", "Food & Drink": "home", "Around the House": "home", "Body & Health": "heart", "Colours & Descriptions": "palette", "Common Verbs": "bolt", "Weather & Nature": "cloud", "Travel & Directions": "map", "Shopping & Money": "target", "Emotions & Opinions": "heart", "Everyday Actions": "calendar", "Work & Study": "briefcase", "Connectors & Structure": "link", "Abstract & Advanced": "layers", "Media & Communication": "message", "Sport & Leisure": "trophy", "Technology & Digital": "chip" };
  const reviewQueueItems = [
    { key: "due", title: "Today's review", count: resolvedDue.total, detail: formatModeBreakdown(resolvedDue.byMode), icon: "target", color: A, onClick: startDueReview },
    { key: "weak", title: "Weak areas", count: resolvedWeak.total, detail: formatModeBreakdown(resolvedWeak.byMode), icon: "target", color: R, onClick: startWeakReview },
    { key: "almost", title: "Almost mastered", count: almostCards.total, detail: formatModeBreakdown(almostCards.byMode), icon: "trophy", color: G, onClick: startAlmostReview },
  ].filter(item => item.count > 0);

  const Header = ({ extra }) => (
    <div style={{
      paddingTop: "max(12px, env(safe-area-inset-top))",
      marginBottom: 14,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <button onClick={() => setScreen("home")} style={{
          background: "transparent", border: `1px solid ${A}33`, borderRadius: 10,
          color: A, fontSize: 13, cursor: "pointer", padding: "8px 14px",
          fontWeight: 600, letterSpacing: 0.3, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6
        }}><Icon name="arrowLeft" size={14} /> Back</button>
        <div style={{ fontSize: 11, color: TD, fontWeight: 600, textAlign: "right", lineHeight: 1.3, minWidth: 0, flex: 1 }}>
          <div style={{ color: T, fontWeight: 700, letterSpacing: 0.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {extra}{category}
          </div>
          <div style={{ fontSize: 10, marginTop: 2, letterSpacing: 1 }}>
            {rpt > 0 && <span style={{ color: R, fontWeight: 700, marginRight: 6 }}>R{rpt + 1}</span>}
            <span style={{ color: TD }}>{idx + 1} / {cards.length}</span>
          </div>
        </div>
      </div>
    </div>
  );

  // NEW: Automaticity badge shown after answer
  const SpeedBadge = ({ ms }) => {
    if (!ms || !answered) return null;
    const { text, color } = speedLabel(ms);
    return (<div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 6, textAlign: "center" }}>{text} ({(ms / 1000).toFixed(1)}s)</div>);
  };

  // NEW: Hint toggle button for cards with mnemonic hints
  const HintBtn = ({ hint }) => {
    if (!hint) return null;
    if (showHint) return (<div style={{ marginTop: 6, padding: "8px 12px", background: "#0A0A0A66", borderRadius: 8, fontSize: 11, color: BL, lineHeight: 1.4, borderLeft: `3px solid ${BL}`, display: "flex", gap: 6, alignItems: "flex-start" }}><Icon name="target" size={13} style={{ marginTop: 1 }} /> <span>{hint}</span></div>);
    return (<button onClick={() => setShowHint(true)} style={{ marginTop: 6, background: "none", border: `1px solid ${BL}44`, borderRadius: 8, padding: "4px 10px", color: BL, fontSize: 11, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="target" size={13} /> Show hint</button>);
  };

  // Per-card stats shown after answering
  const CardStats = () => {
    if (!answered || !card) return null;
    const key = gk(card, category, mode);
    const n = normalizeEntry(prog[key]);
    if (!n.stats.attempts) return null;
    // "Last seen" helper — reinforces SRS intuition. Pulled from in-session ref, not prog.
    const priorLastSeen = priorLastSeenRef.current[key];
    let lastSeenLabel = null;
    if (priorLastSeen && n.stats.attempts > 1) {
      const daysAgo = Math.floor((Date.now() - priorLastSeen) / 86400000);
      if (daysAgo >= 1) lastSeenLabel = `Last seen ${daysAgo}d ago`;
      else {
        const hoursAgo = Math.floor((Date.now() - priorLastSeen) / 3600000);
        if (hoursAgo >= 1) lastSeenLabel = `Last seen ${hoursAgo}h ago`;
      }
    }
    return (
      <>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 8, fontSize: 11, color: TD, letterSpacing: 0.2 }}>
          <span>Attempts {n.stats.attempts}</span>
          <span style={{ opacity: 0.35 }}>•</span>
          <span style={{ color: G }}>✓ {n.stats.correct}</span>
          <span style={{ opacity: 0.35 }}>•</span>
          <span style={{ color: R }}>✗ {n.stats.incorrect}</span>
        </div>
        {lastSeenLabel && <div style={{ fontSize: 10, color: TD, marginTop: 4, textAlign: "center", opacity: 0.7 }}>{lastSeenLabel}</div>}
      </>
    );
  };

  const maxC = setupCat === "__all__" ? totalW : setupCat === "__grammar__" ? CLOZE.length : setupCat === "__verb__" ? 30 : setupCat === "__sentence__" ? SENTENCES.length : setupCat === "__imperativ__" ? IMPERATIVES.length : setupCat === "__listening__" ? DIALOGUES.length : setupCat === "__weak__" ? Math.max(weakCards.size, 1) : (V[setupCat]?.length || nouns.length);
  const hasNouns = setupCat && !["__all__", "__grammar__", "__verb__", "__sentence__", "__weak__"].includes(setupCat) && nouns.some(n => n.cat === setupCat);

  return (
    <div style={{ fontFamily: BD, background: BG, color: T, minHeight: "100vh", maxWidth: 480, margin: "0 auto", position: "relative" }}>
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* ── FIRST-RUN ONBOARDING ── */}
      {showOnboarding && <div style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.92)", padding: 22 }}>
        <div role="dialog" aria-modal="true" aria-label="Welcome to AutoDeutsch" style={{ background: SOFT_PANEL, border: `1px solid ${A}2E`, borderRadius: 18, padding: "26px 22px 22px", width: "100%", maxWidth: 390, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.45)" }}>
          <div style={{ height: 3, width: 74, background: FLAG, borderRadius: 2, marginBottom: 18 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <IconBadge name="book" size={38} />
            <div>
              <div style={{ fontSize: 10, color: TD, fontWeight: 800, letterSpacing: 2.4, textTransform: "uppercase" }}>Welcome</div>
              <h2 style={{ fontFamily: FN, fontSize: 23, margin: "2px 0 0", lineHeight: 1.05 }}>Set up AutoDeutsch</h2>
            </div>
          </div>
          <p style={{ color: TD, fontSize: 12, lineHeight: 1.55, margin: "0 0 18px" }}>A quick setup tunes your daily target and default practice style. Everything still saves locally and works offline after the first cached launch.</p>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: TD, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 8 }}>Starting level</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {["A1", "A2", "B1"].map(level => (
                <button key={level} type="button" onClick={() => setOnboardingLevel(level)} style={{ padding: "11px 8px", borderRadius: 10, border: `1px solid ${onboardingLevel === level ? A : B}`, background: onboardingLevel === level ? `${A}18` : "#0D0D0D", color: onboardingLevel === level ? A : T, fontWeight: 800, cursor: "pointer", fontFamily: FN }}>{level}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: TD, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 8 }}>Daily target</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[10, 20, 30].map(goal => (
                <button key={goal} type="button" onClick={() => setOnboardingGoal(goal)} style={{ padding: "11px 8px", borderRadius: 10, border: `1px solid ${onboardingGoal === goal ? A : B}`, background: onboardingGoal === goal ? `${A}18` : "#0D0D0D", color: onboardingGoal === goal ? A : T, fontWeight: 800, cursor: "pointer", fontFamily: FN }}>{goal}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: TD, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 8 }}>Preferred practice</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
              {[["vocab", "Recognition", "German to English", "book"], ["production", "Production", "English to German", "keyboard"], ["audio", "Audio mode", "Hands-free review", "headphones"]].map(([m, title, sub, icon]) => (
                <button key={m} type="button" onClick={() => setOnboardingMode(m)} style={{ padding: "12px 12px", borderRadius: 11, border: `1px solid ${onboardingMode === m ? A : B}`, background: onboardingMode === m ? `${A}14` : "#0D0D0D", color: T, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left", fontFamily: "inherit" }}>
                  <IconBadge name={icon} size={30} color={onboardingMode === m ? A : TD} />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 800 }}>{title}</span>
                    <span style={{ display: "block", fontSize: 11, color: TD, marginTop: 1 }}>{sub}</span>
                  </span>
                  {onboardingMode === m && <Icon name="check" size={17} style={{ color: A }} />}
                </button>
              ))}
            </div>
          </div>

          <Btn bg={A} color="#0A0A0A" onClick={finishOnboarding} style={{ fontFamily: FN, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            Start learning <Icon name="arrowRight" size={17} />
          </Btn>
          <button type="button" onClick={finishOnboarding} style={{ marginTop: 12, width: "100%", background: "transparent", border: "none", color: TD, fontSize: 12, cursor: "pointer", padding: 8 }}>Use defaults</button>
        </div>
      </div>}

      {/* ── SETUP MODAL — UNCHANGED ── */}
      {showSetup && <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.88)", padding: 24 }} onClick={() => setShowSetup(false)}>
        <div role="dialog" aria-modal="true" aria-label="Session setup" onClick={e => e.stopPropagation()} style={{ background: S, border: `1px solid ${A}33`, borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 360, maxHeight: "90vh", overflowY: "auto", boxShadow: `0 0 40px ${A}11` }}>
          <div style={{ height: 3, background: `linear-gradient(90deg, #1A1A1A 33%, ${R} 33% 66%, ${A} 66%)`, borderRadius: 2, marginBottom: 16 }} />
          <div style={{ fontSize: 10, color: R, fontWeight: 800, letterSpacing: 4, textTransform: "uppercase", marginBottom: 6 }}>Setup</div>
          <h3 style={{ fontFamily: FN, fontSize: 20, margin: "0 0 4px", fontWeight: 700 }}>
            {setupCat === "__all__" ? "All Categories" : setupCat === "__grammar__" ? "Grammar Cloze" : setupCat === "__verb__" ? "Verb Trainer" : setupCat === "__sentence__" ? "Sentence Builder" : setupCat === "__imperativ__" ? "Imperative" : setupCat === "__listening__" ? "Listening Practice" : setupCat === "__weak__" ? "Weak Areas" : setupCat}
          </h3>
          {(setupCat === "__imperativ__" || setupCat === "__listening__") && (
            <div style={{ fontSize: 11, color: TD, marginBottom: 18, fontStyle: "italic" }}>
              {setupCat === "__imperativ__" ? "Imperativ" : "Hör-Training"}
            </div>
          )}
          {!(setupCat === "__imperativ__" || setupCat === "__listening__") && <div style={{ marginBottom: 14 }} />}
          {setupCat && !["__grammar__", "__verb__", "__sentence__", "__imperativ__", "__listening__", "__weak__"].includes(setupCat) && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: TD, marginBottom: 8 }}>Mode</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[["vocab", "DE → EN"], ["production", "EN → DE"], ["audio", "Audio"]].map(([m, l]) => (
                  <button key={m} onClick={() => setSetupMode(m)} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: setupMode === m ? A : "transparent", color: setupMode === m ? "#0A0A0A" : TD, border: `1px solid ${setupMode === m ? A : B}` }}>{l}</button>
                ))}
                {(hasNouns || setupCat === "__all__") && <button onClick={() => setSetupMode("article")} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: setupMode === "article" ? A : "transparent", color: setupMode === "article" ? "#0A0A0A" : TD, border: `1px solid ${setupMode === "article" ? A : B}` }}>der/die/das</button>}
              </div>
            </div>
          )}
          {setupMode === "audio" && !["__grammar__", "__verb__", "__sentence__", "__imperativ__", "__listening__", "__weak__"].includes(setupCat) && (
            <>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: TD, marginBottom: 8 }}>Order</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setAudioEnFirst(false)} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: !audioEnFirst ? A : "transparent", color: !audioEnFirst ? "#0A0A0A" : TD, border: `1px solid ${!audioEnFirst ? A : B}` }}>DE → EN</button>
                  <button onClick={() => setAudioEnFirst(true)} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: audioEnFirst ? A : "transparent", color: audioEnFirst ? "#0A0A0A" : TD, border: `1px solid ${audioEnFirst ? A : B}` }}>EN → DE</button>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: TD, marginBottom: 8 }}>Pause between</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[[2000, "2s"], [3500, "3.5s"], [5000, "5s"], [7000, "7s"]].map(([ms, l]) => (
                    <button key={ms} onClick={() => setAudioPauseLen(ms)} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: audioPauseLen === ms ? A : "transparent", color: audioPauseLen === ms ? "#0A0A0A" : TD, border: `1px solid ${audioPauseLen === ms ? A : B}` }}>{l}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <button onClick={() => setAudioIncludeExample(x => !x)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: audioIncludeExample ? `${A}22` : "transparent", color: audioIncludeExample ? A : TD, border: `1px solid ${audioIncludeExample ? A : B}`, textAlign: "left" }}>
                  {audioIncludeExample ? "✓" : "○"} Include example sentence
                </button>
              </div>
              <p style={{ fontSize: 10, color: TD, marginBottom: 14, lineHeight: 1.4, padding: "8px 12px", background: "#0A0A0A66", borderRadius: 8, borderLeft: `3px solid ${BL}` }}>
                Keep the screen on. Audio mode uses the browser's speech engine and pauses if iOS locks the screen.
              </p>
            </>
          )}
          {setupCat === "__verb__" && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: TD, marginBottom: 8 }}>Tense</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[["present", "Präsens"], ["perfekt", "Perfekt"]].map(([t, l]) => (
                  <button key={t} onClick={() => setVerbTense(t)} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: verbTense === t ? A : "transparent", color: verbTense === t ? "#0A0A0A" : TD, border: `1px solid ${verbTense === t ? A : B}` }}>{l}</button>
                ))}
              </div>
            </div>
          )}
          {setupCat === "__imperativ__" && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: TD, marginBottom: 8 }}>Persons (tap to toggle)</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[["du", "du"], ["ihr", "ihr"], ["sie", "Sie"]].map(([k, l]) => {
                  const on = impPersons[k];
                  const anyOthers = Object.entries(impPersons).some(([kk, v]) => kk !== k && v);
                  return (
                    <button key={k} onClick={() => {
                      // don't allow deselecting the last one
                      if (on && !anyOthers) return;
                      setImpPersons(p => ({ ...p, [k]: !p[k] }));
                    }} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: on ? A : "transparent", color: on ? "#0A0A0A" : TD, border: `1px solid ${on ? A : B}` }}>{l}</button>
                  );
                })}
              </div>
            </div>
          )}
          {setupCat === "__listening__" && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: TD, marginBottom: 8 }}>Mode</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[["listen", "Full Dialogue", "Vollständiger Dialog"], ["questions", "With Questions", "Mit Verständnisfragen"]].map(([m, l, de]) => (
                  <button key={m} onClick={() => setListenMode(m)} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: listenMode === m ? A : "transparent", color: listenMode === m ? "#0A0A0A" : TD, border: `1px solid ${listenMode === m ? A : B}`, display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
                    <span>{l}</span>
                    <span style={{ fontSize: 9, opacity: 0.7, fontWeight: 500, marginTop: 2 }}>{de}</span>
                  </button>
                ))}
              </div>
              {listenMode === "questions" && <p style={{ fontSize: 10, color: TD, marginTop: 8, lineHeight: 1.4 }}>Only dialogues with questions will be included ({DIALOGUES.filter(d => d.questions).length} available).</p>}
            </div>
          )}
          {!["__grammar__", "__verb__", "__sentence__", "__imperativ__", "__listening__", "__weak__"].includes(setupCat) && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: TD, marginBottom: 8 }}>Difficulty</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[["mixed", "Mixed"], ["easy", "Easy"], ["hard", "Hard"]].map(([k, l]) => (
                  <button key={k} onClick={() => setSessDiff(k)} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: sessDiff === k ? A : "transparent", color: sessDiff === k ? "#0A0A0A" : TD, border: `1px solid ${sessDiff === k ? A : B}` }}>{l}</button>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: TD }}>Cards</span><span style={{ fontFamily: FN, fontSize: 28, color: A }}>{sessLen}</span>
            </div>
            <input type="range" aria-label="Cards per session" min={Math.min(5, maxC)} max={maxC} step={1} value={sessLen} onChange={e => setSessLen(Number(e.target.value))} style={{ width: "100%", height: 6, appearance: "none", background: B, borderRadius: 3, outline: "none", cursor: "pointer", accentColor: A }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {/* Sensible presets: 5/10/15/20/25/50, capped at maxC. "All" available only when pool <= 50. */}
              {[5, 10, 15, 20, 25, 50].filter((n, i, a) => n <= maxC && a.indexOf(n) === i).map(n => (
                <button key={n} onClick={() => setSessLen(n)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: sessLen === n ? A : "transparent", color: sessLen === n ? "#0A0A0A" : TD, border: `1px solid ${sessLen === n ? A : B}` }}>{n}</button>
              ))}
              {maxC <= 50 && sessLen !== maxC && (
                <button onClick={() => setSessLen(maxC)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "transparent", color: TD, border: `1px solid ${B}` }}>All {maxC}</button>
              )}
            </div>
          </div>
          {sessLen > 40 && <p style={{ fontSize: 11, color: A, marginBottom: 14, lineHeight: 1.5, padding: "8px 12px", background: "#0A0A0A66", borderRadius: 8, borderLeft: `3px solid ${A}` }}>Long session. Shorter repeated sessions build habit faster than one marathon.</p>}
          <p style={{ fontSize: 11, color: TD, marginBottom: 18, lineHeight: 1.5 }}>Failed cards repeat until cleared.</p>
          <Btn bg={A} color="#0A0A0A" onClick={() => { const m = setupCat === "__grammar__" ? "cloze" : setupCat === "__verb__" ? "verb" : setupCat === "__sentence__" ? "sentence" : setupCat === "__imperativ__" ? "imperativ" : setupCat === "__listening__" ? "listening" : setupMode; startSession(setupCat, m, sessLen); }} style={{ fontFamily: FN, fontSize: 16 }}>Start</Btn>
        </div>
      </div>}

      {/* ── SETTINGS MODAL ── */}
      {showSettings && <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.88)", padding: 24 }} onClick={() => setShowSettings(false)}>
        <div role="dialog" aria-modal="true" aria-label="Settings" onClick={e => e.stopPropagation()} style={{ background: S, border: `1px solid ${A}33`, borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 360, maxHeight: "90vh", overflowY: "auto", boxShadow: `0 0 40px ${A}11` }}>
          <div style={{ height: 3, width: 72, background: FLAG, borderRadius: 2, marginBottom: 16 }} />
          <div style={{ fontSize: 10, color: R, fontWeight: 800, letterSpacing: 4, textTransform: "uppercase", marginBottom: 6 }}>Settings</div>

          <h3 style={{ fontFamily: FN, fontSize: 16, margin: "0 0 10px", fontWeight: 700 }}>Offline & Storage</h3>
          <div style={{ marginBottom: 20, display: "grid", gap: 8 }}>
            {[
              { label: offlineReady ? "Offline ready" : "Cache pending", value: offlineReady ? "App shell cached" : "Open once online to cache", icon: offlineReady ? "shield" : "wifi", color: offlineReady ? G : A },
              { label: storageOK ? "Saving locally" : "Storage blocked", value: storageOK ? saveStatus : "Progress will not persist", icon: storageOK ? "save" : "shield", color: storageOK ? G : R },
              { label: online ? "Online" : "Offline", value: online ? "Updates can be checked" : "Practice still works from cache", icon: "wifi", color: online ? BL : A },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#0A0A0A66", border: `1px solid ${B}`, borderRadius: 10 }}>
                <IconBadge name={item.icon} size={30} color={item.color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: T, fontSize: 12, fontWeight: 800 }}>{item.label}</div>
                  <div style={{ color: TD, fontSize: 11, marginTop: 1 }}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Daily goal — cards-per-day target shown on home's streak row */}
          <h3 style={{ fontFamily: FN, fontSize: 16, margin: "0 0 10px", fontWeight: 700 }}>Daily Goal</h3>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: TD }}>Cards per day</span>
              <span style={{ fontFamily: FN, fontSize: 28, color: A }}>{dailyGoal}</span>
            </div>
            <input type="range" aria-label="Cards per day" min={10} max={200} step={1} value={dailyGoal} onChange={e => updateDailyGoal(Number(e.target.value))}
              style={{ width: "100%", height: 6, appearance: "none", background: B, borderRadius: 3, outline: "none", cursor: "pointer", accentColor: A }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {[10, 20, 30, 50, 100, 200].map(n => (
                <button key={n} onClick={() => updateDailyGoal(n)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: dailyGoal === n ? A : "transparent", color: dailyGoal === n ? "#0A0A0A" : TD, border: `1px solid ${dailyGoal === n ? A : B}` }}>{n}</button>
              ))}
            </div>
            {dailyGoal > 60 && <p style={{ fontSize: 11, color: A, marginTop: 12, lineHeight: 1.5, padding: "8px 12px", background: "#0A0A0A66", borderRadius: 8, borderLeft: `3px solid ${A}` }}>Ambitious goal. Consistency beats intensity — missing a big target often hurts streak motivation more than a smaller goal would.</p>}
          </div>

          <h3 style={{ fontFamily: FN, fontSize: 16, margin: "0 0 10px", fontWeight: 700 }}>App Updates</h3>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: TD, marginBottom: 6 }}>Current build: <span style={{ color: A, fontFamily: "monospace" }}>{APP_VERSION}</span></div>
            <Btn bg={SH} border={`1px solid ${A}44`} color={A} onClick={async () => {
              const reg = window.__SW_REG__;
              if (!reg) { setUpdateCheckMsg("Service worker not registered yet."); return; }
              setUpdateCheckMsg("Checking…");
              try {
                await reg.update();
                // Give the browser a moment to install the new worker if there is one
                setTimeout(() => {
                  if (window.__SW_WAITING__) setUpdateCheckMsg("✓ Update available — tap the banner on home.");
                  else setUpdateCheckMsg("You're on the latest version.");
                }, 1500);
              } catch (e) {
                setUpdateCheckMsg("Check failed: " + (e.message || "network error"));
              }
            }} style={{ fontFamily: FN, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Icon name="refresh" size={16} /> Check for updates</Btn>
            {updateCheckMsg && (
              <div style={{ fontSize: 11, color: updateCheckMsg.startsWith("✓") ? G : updateCheckMsg.startsWith("Check failed") ? R : TD, marginTop: 8, padding: "8px 12px", background: "#0A0A0A66", borderRadius: 8 }}>{updateCheckMsg}</div>
            )}
          </div>

          <h3 style={{ fontFamily: FN, fontSize: 16, margin: "0 0 10px", fontWeight: 700 }}>Backup & Restore</h3>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: TD, marginBottom: 6 }}>Export your progress to a file you can save anywhere (iCloud, email, etc.).</div>
            <Btn bg={SH} border={`1px solid ${A}44`} color={A} onClick={exportData} style={{ fontFamily: FN, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Icon name="download" size={16} /> Export progress</Btn>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: TD, marginBottom: 6 }}>Restore from a previously exported file. Merges with current progress (keeps whichever entry has more attempts).</div>
            <label style={{ display: "flex", padding: "14px 16px", borderRadius: 14, border: `1px solid ${B}`, background: SH, color: T, fontSize: 14, fontWeight: 700, textAlign: "center", cursor: "pointer", fontFamily: FN, alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Icon name="upload" size={16} /> Import progress
              <input type="file" accept="application/json,.json" onChange={e => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ""; }} style={{ display: "none" }} />
            </label>
          </div>

          {importError && (
            <div style={{ fontSize: 11, color: importError.startsWith("✓") ? G : R, marginBottom: 14, padding: "8px 12px", background: importError.startsWith("✓") ? "#0A1A0A" : "#1A0000", borderRadius: 8, borderLeft: `3px solid ${importError.startsWith("✓") ? G : R}` }}>{importError}</div>
          )}

          <div style={{ marginTop: 18, padding: "10px 12px", background: "#0A0A0A66", borderRadius: 8, fontSize: 11, color: TD, lineHeight: 1.5, borderLeft: `3px solid ${BL}` }}>
            <strong style={{ color: T }}>Current state</strong><br />
            {Object.keys(prog).length} entries · {totalL} mastered · {dailyStats.streak}-day streak
          </div>

          <Btn bg={SH} border={`1px solid ${B}`} onClick={() => setShowSettings(false)} style={{ marginTop: 18, fontSize: 14 }}>Close</Btn>
        </div>
      </div>}

      {/* ── HOME ── */}
      {screen === "home" && <div style={{ padding: "12px 20px 24px" }}>
        {/* Update available — appears when a new SW version is installed and waiting */}
        {updateAvailable && (
          <button onClick={applyUpdate}
            style={{ width: "100%", background: A, color: "#0A0A0A", border: "none", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12, lineHeight: 1.4, cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}><Icon name="refresh" size={18} /><span><strong>Update available</strong><br /><span style={{ fontWeight: 500, fontSize: 11, opacity: 0.8 }}>Tap to reload with the new version</span></span></span>
            <Icon name="arrowRight" size={17} />
          </button>
        )}

        {/* Storage warning — only shown if localStorage is not writable */}
        {!storageOK && (
          <div style={{ background: "#1A0000", border: `1px solid ${R}55`, borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: R, lineHeight: 1.4 }}>
            <strong>Progress won't save</strong><br />
            <span style={{ color: T, fontWeight: 400, fontSize: 11 }}>Private browsing is on, or storage is full. Nothing you do this session will be remembered.</span>
          </div>
        )}

        {/* Hero */}
        <div style={{ background: SOFT_PANEL, border: `1px solid ${B}`, borderRadius: 14, padding: "24px 22px 20px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: FLAG }} />
          <button onClick={() => { setShowSettings(true); setImportError(""); setUpdateCheckMsg(""); }} aria-label="Settings"
            style={{ position: "absolute", top: 10, right: 10, background: "#0A0A0A66", border: `1px solid ${B}`, borderRadius: 9, color: TD, cursor: "pointer", padding: 7, lineHeight: 1 }}><Icon name="settings" size={16} /></button>
          <div style={{ fontSize: 11, color: TD, fontWeight: 700, letterSpacing: 0.6, marginBottom: 6 }}>Learn German</div>
          <h1 style={{ fontFamily: FN, fontSize: 34, margin: "0 0 6px", fontWeight: 800, lineHeight: 1, color: T, display: "flex", alignItems: "center" }}>
            <img src="icons/icon-192x192.png" alt="AutoDeutsch" style={{ width: 38, height: 38, mixBlendMode: "screen", marginLeft: -6, marginRight: -2 }} />
            <span>utodeutsch</span>
          </h1>
          <p style={{ color: TD, fontSize: 13, margin: "0 0 14px" }}>Offline-first German trainer · {totalW} cards · {totalL} mastered</p>
          <div style={{ height: 4, background: "#222", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${totalW > 0 ? (totalL / totalW) * 100 : 0}%`, background: A, borderRadius: 2, transition: "width 0.5s" }} />
          </div>
        </div>

        <div style={{ fontSize: 11, color: TD, fontWeight: 700, letterSpacing: 0.6, margin: "2px 0 10px" }}>Today</div>
        {/* Today metrics */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ background: SH, border: `1px solid ${B}`, borderRadius: 14, padding: "14px 16px", flex: 1, textAlign: "center" }}>
            <div style={{ fontFamily: FN, fontSize: 26, color: T, fontWeight: 800 }}>{dailyStats.streak}</div>
            <div style={{ fontSize: 10, color: TD, fontWeight: 600, letterSpacing: 0.4 }}>Day streak</div>
          </div>
          <div style={{ background: SH, border: `1px solid ${B}`, borderRadius: 14, padding: "14px 16px", flex: 2, textAlign: "center" }}>
            <div style={{ fontFamily: FN, fontSize: 26, fontWeight: 800 }}>
              <span style={{ color: dailyStats.count >= dailyGoal ? G : T }}>{dailyStats.count}</span>
              <span style={{ color: TD, fontSize: 16 }}> / {dailyGoal}</span>
            </div>
            <div style={{ fontSize: 10, color: TD, fontWeight: 600, letterSpacing: 0.4 }}>Cards today</div>
            <div style={{ height: 3, background: "#0A0A0A", borderRadius: 2, overflow: "hidden", marginTop: 8 }}>
              <div style={{ height: "100%", width: `${dailyGoalPct * 100}%`, background: dailyStats.count >= dailyGoal ? G : A, borderRadius: 2, transition: "width 0.35s ease-out" }} />
            </div>
            {dailyStats.count >= dailyGoal && <div style={{ fontSize: 10, color: G, marginTop: 4, fontWeight: 700 }}>✓ Goal reached</div>}
          </div>
        </div>

        {/* Review queue */}
        {reviewQueueItems.length > 0 && (
          <div style={{ background: SH, border: `1px solid ${B}`, borderRadius: 14, padding: "16px 14px 12px", marginBottom: 14, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: FLAG, opacity: 0.8 }} />
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10, paddingTop: 2 }}>
              <div style={{ fontSize: 11, color: T, fontWeight: 800, letterSpacing: 0.4 }}>Review queue</div>
              <div style={{ fontSize: 10, color: TD }}>{reviewQueueItems.reduce((sum, item) => sum + item.count, 0)} waiting</div>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {reviewQueueItems.map(item => (
                <button key={item.key} type="button" onClick={item.onClick}
                  style={{ width: "100%", background: "#0F0F0F", color: T, border: `1px solid ${item.color}33`, borderRadius: 10, padding: "11px 12px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit" }}>
                  <IconBadge name={item.icon} size={28} color={item.color} bg="#0A0A0A66" />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 13, color: T, fontWeight: 800 }}>{item.title}</span>
                      <span style={{ fontSize: 12, color: item.color, fontWeight: 800 }}>{item.count}</span>
                    </span>
                    <span style={{ display: "block", fontSize: 10, color: TD, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.detail}</span>
                  </span>
                  <Icon name="arrowRight" size={15} style={{ color: TD, opacity: 0.75 }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Primary actions */}
        <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
          <button type="button" onClick={() => openSetup("__all__", setupMode)}
            style={{ width: "100%", background: A, color: "#0A0A0A", border: "none", borderRadius: 12, padding: "16px 18px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontFamily: "inherit", fontWeight: 800, boxShadow: `0 10px 24px ${A}16` }}>
            <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <IconBadge name={setupMode === "audio" ? "headphones" : setupMode === "production" ? "keyboard" : "play"} size={36} color="#0A0A0A" bg="#0A0A0A18" />
              <span>
                <span style={{ display: "block", fontSize: 11, opacity: 0.74, fontWeight: 800 }}>Start practice</span>
                <span style={{ display: "block", fontFamily: FN, fontSize: 16, marginTop: 2 }}>Shuffle all cards</span>
              </span>
            </span>
            <Icon name="arrowRight" size={20} />
          </button>

          <div style={{ display: "grid", gridTemplateColumns: lastSession ? "1fr 1fr" : "1fr", gap: 10 }}>
            {lastSession && <button type="button" onClick={() => lastSession.cat === "__due__" ? startDueReview() : startSession(lastSession.cat, lastSession.m, lastSession.count)}
              style={{ width: "100%", background: "#0F0F0F", color: T, border: `1px solid ${A}36`, borderRadius: 12, padding: "13px 14px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit", fontWeight: 700 }}>
              <IconBadge name="refresh" size={30} color={A} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", color: A, fontSize: 10, fontWeight: 800 }}>Continue</span>
                <span style={{ display: "block", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lastSession.label}</span>
              </span>
            </button>}
            <button type="button" onClick={() => openSetup("__all__", setupMode)}
              style={{ width: "100%", background: "#0F0F0F", color: T, border: `1px solid ${B}`, borderRadius: 12, padding: "13px 14px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit", fontWeight: 700 }}>
              <IconBadge name="layers" size={30} color={TD} />
              <span>
                <span style={{ display: "block", color: TD, fontSize: 10, fontWeight: 800 }}>All cards</span>
                <span style={{ display: "block", fontSize: 12 }}>Custom session</span>
              </span>
            </button>
          </div>
        </div>
        {/* Progress (last 30 days, first-attempt only) */}
        <div style={{ background: SH, border: `1px solid ${B}`, borderRadius: 14, padding: "14px 16px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: FLAG, opacity: 0.75 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
            <div style={{ fontSize: 10, color: TD, fontWeight: 700, letterSpacing: 2, }}>Last 30 days</div>
            <div style={{ fontSize: 10, color: TD, fontStyle: "italic" }}>first-try only</div>
          </div>

          {trend30.totalAttempts < 3 ? (
            <div style={{ marginTop: 14, padding: "4px 0 2px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div style={{ background: "#0F0F0F", border: `1px solid ${B}`, borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
                  <div style={{ fontFamily: FN, fontSize: 24, color: T, fontWeight: 800 }}>{trend30.totalAttempts}</div>
                  <div style={{ fontSize: 10, color: TD, fontWeight: 700, letterSpacing: 0.4 }}>Saved</div>
                </div>
                <div style={{ background: "#0F0F0F", border: `1px solid ${B}`, borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
                  <div style={{ fontFamily: FN, fontSize: 24, color: A, fontWeight: 800 }}>{Math.max(0, 3 - trend30.totalAttempts)}</div>
                  <div style={{ fontSize: 10, color: TD, fontWeight: 700, letterSpacing: 0.4 }}>To unlock</div>
                </div>
              </div>
              <svg viewBox="0 0 300 34" width="100%" height="34" style={{ display: "block", marginBottom: 6 }} aria-hidden="true">
                <line x1="6" y1="17" x2="294" y2="17" stroke={`${TD}22`} strokeWidth="2" strokeLinecap="round" />
                {[0, 1, 2].map(i => (
                  <circle key={i} cx={38 + i * 112} cy="17" r={i < trend30.totalAttempts ? 5 : 3.5} fill={i < trend30.totalAttempts ? A : `${TD}55`} />
                ))}
              </svg>
              <div style={{ fontSize: 11, color: TD, textAlign: "center", lineHeight: 1.45 }}>Answer three first-try cards to unlock accuracy and pace trends.</div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 16, marginTop: 10, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FN, fontSize: 28, color: trend30.accuracy >= 80 ? G : trend30.accuracy >= 60 ? A : R, fontWeight: 800 }}>{trend30.accuracy}%</div>
                  <div style={{ fontSize: 10, color: TD, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Accuracy</div>
                </div>
                <div style={{ width: 1, background: B }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FN, fontSize: 28, color: trend30.avgSec < 8 ? G : trend30.avgSec < 15 ? A : R, fontWeight: 800 }}>{trend30.avgSec.toFixed(1)}<span style={{ fontSize: 14, color: TD, fontWeight: 600 }}>s</span></div>
                  <div style={{ fontSize: 10, color: TD, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Avg time</div>
                </div>
                <div style={{ width: 1, background: B }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FN, fontSize: 28, color: T, fontWeight: 800 }}>{trend30.totalAttempts}</div>
                  <div style={{ fontSize: 10, color: TD, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Cards</div>
                </div>
              </div>

              {/* Sparkline — daily accuracy over last 30 days. Missing days (no attempts) shown as low dots */}
              <svg viewBox="0 0 300 50" width="100%" height="40" style={{ display: "block", marginBottom: 10 }}>
                {(() => {
                  const pts = trend30.days.map((d, i) => {
                    const x = (i / 29) * 300;
                    const acc = d.attempts > 0 ? (d.correct / d.attempts) * 100 : null;
                    const y = acc === null ? 45 : 50 - (acc / 100) * 44 - 3;
                    return { x, y, acc, attempts: d.attempts };
                  });
                  const linePath = pts.filter(p => p.acc !== null).map((p, i, arr) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
                  return (
                    <>
                      <line x1="0" y1="6" x2="300" y2="6" stroke={`${A}22`} strokeDasharray="2,3" />
                      <line x1="0" y1="28" x2="300" y2="28" stroke={`${TD}22`} strokeDasharray="2,3" />
                      {linePath && <path d={linePath} fill="none" stroke={A} strokeWidth="1.5" strokeLinejoin="round" />}
                      {pts.map((p, i) => p.acc === null ? (
                        <circle key={i} cx={p.x} cy="47" r="1" fill={`${TD}55`} />
                      ) : (
                        <circle key={i} cx={p.x} cy={p.y} r={p.attempts >= 3 ? 2 : 1.4} fill={p.acc >= 80 ? G : p.acc >= 60 ? A : R} />
                      ))}
                    </>
                  );
                })()}
              </svg>

              <button onClick={() => setShowTrendBreakdown(v => !v)}
                style={{ background: "none", border: "none", color: TD, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "4px 0", width: "100%", textAlign: "left" }}>
                {showTrendBreakdown ? "▾" : "▸"} Daily breakdown
              </button>

              {showTrendBreakdown && (
                <div style={{ marginTop: 8, maxHeight: 220, overflowY: "auto", borderTop: `1px solid ${B}`, paddingTop: 8 }}>
                  {trend30.days.filter(d => d.attempts > 0).slice().reverse().slice(0, 30).map(d => {
                    const acc = Math.round((d.correct / d.attempts) * 100);
                    const avg = (d.totalMs / d.attempts / 1000).toFixed(1);
                    const label = (() => {
                      const dd = new Date(d.date + "T00:00:00");
                      const today = new Date(); today.setHours(0,0,0,0);
                      const diff = Math.round((today - dd) / 86400000);
                      if (diff === 0) return "Today";
                      if (diff === 1) return "Yesterday";
                      return dd.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
                    })();
                    return (
                      <div key={d.date} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 12, borderBottom: `1px solid ${B}44` }}>
                        <span style={{ color: T, fontWeight: 500, flex: 1 }}>{label}</span>
                        <span style={{ color: TD, fontSize: 11, width: 50, textAlign: "right" }}>{d.attempts} cards</span>
                        <span style={{ color: acc >= 80 ? G : acc >= 60 ? A : R, fontWeight: 700, width: 48, textAlign: "right" }}>{acc}%</span>
                        <span style={{ color: TD, fontSize: 11, width: 50, textAlign: "right" }}>{avg}s</span>
                      </div>
                    );
                  })}
                  {trend30.days.filter(d => d.attempts > 0).length === 0 && (
                    <div style={{ fontSize: 11, color: TD, textAlign: "center", padding: 10 }}>No activity yet.</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Library */}
        <div style={{ fontSize: 11, color: TD, fontWeight: 800, letterSpacing: 0.6, marginTop: 32, marginBottom: 12 }}>Library</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {CATS.map(cat => {
            const st = getCatStats(cat);
            const pct = st.total > 0 ? (st.seen / st.total) * 100 : 0;
            const done = st.seen >= st.total;
            return (
              <button key={cat} onClick={() => openSetup(cat)} style={{ background: "#101010", border: `1px solid ${B}`, borderRadius: 12, padding: "16px 13px 13px", textAlign: "left", cursor: "pointer", transition: "all 0.15s, transform 0.1s", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", bottom: 0, left: 0, height: 2, width: `${pct}%`, background: done ? G : A, opacity: 0.4, transition: "width 0.5s" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <IconBadge name={categoryIcons[cat] || "book"} size={28} color={done ? G : A} bg="#0A0A0A66" />
                  <span style={{ fontFamily: FN, fontSize: 14, color: T, lineHeight: 1.2, fontWeight: 700 }}>{cat}</span>
                </div>
                <div style={{ fontSize: 11, color: TD, fontWeight: 500 }}>{st.seen} <span style={{ opacity: 0.8 }}>/ {st.total}</span></div>
              </button>
            );
          })}
        </div>

        {/* Training — grouped parent card with core drill modes */}
        <div style={{ marginTop: 32, background: SH, border: `1px solid ${B}`, borderRadius: 14, padding: "22px 12px 14px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: FLAG, opacity: 0.8 }} />
          <div style={{ fontSize: 11, color: TD, fontWeight: 800, letterSpacing: 0.6, marginBottom: 12, paddingLeft: 4 }}>Training</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { l: "der / die / das", icon: "book", c: "__all__", m: "article" },
              { l: "Grammar Cloze", icon: "layers", c: "__grammar__", m: "cloze" },
              { l: "Verb Trainer", icon: "bolt", c: "__verb__", m: "verb" },
              { l: "Sentence Builder", icon: "keyboard", c: "__sentence__", m: "sentence" },
              { l: "Imperative", s: "Imperativ", icon: "target", c: "__imperativ__", m: "imperativ" },
              { l: "Listening", s: "Hör-Training", icon: "headphones", c: "__listening__", m: "listening" },
            ].map(({ l, s, icon, c, m }) => {
              const ts = trainingStats[m];
              const pct = ts && ts.total > 0 ? (ts.seen / ts.total) * 100 : 0;
              const done = ts && ts.seen >= ts.total && ts.total > 0;
              return (
                <button key={m} onClick={() => { setSetupCat(c); setSetupMode(m); setSessLen(Math.min(15, m === "cloze" ? CLOZE.length : m === "verb" ? 30 : m === "sentence" ? SENTENCES.length : m === "imperativ" ? IMPERATIVES.length : m === "listening" ? DIALOGUES.length : nouns.length)); setShowSetup(true); }}
                  style={{ background: "#0F0F0F", border: `1px solid ${B}88`, borderRadius: 10, padding: "12px 12px", textAlign: "left", cursor: "pointer", transition: "all 0.15s, transform 0.1s", display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit", position: "relative", overflow: "hidden" }}>
                  {ts && <div style={{ position: "absolute", bottom: 0, left: 0, height: 1.5, width: `${pct}%`, background: done ? G : A, opacity: 0.25, transition: "width 0.5s" }} />}
                  <IconBadge name={icon} size={30} color={done ? G : A} bg="#0A0A0A66" />
                  <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                    <span style={{ fontFamily: FN, fontSize: 13, color: T, fontWeight: 700 }}>{l}</span>
                    {ts ? (
                      <span style={{ fontSize: 10, color: TD, marginTop: 1, opacity: 0.75, display: "flex", gap: 6, alignItems: "baseline" }}>
                        {s && <span style={{ opacity: 0.9 }}>{s}</span>}
                        {s && <span style={{ opacity: 0.35 }}>·</span>}
                        <span style={{ opacity: 0.75 }}>{ts.seen} <span style={{ opacity: 0.8 }}>/ {ts.total}</span></span>
                      </span>
                    ) : s ? (
                      <span style={{ fontSize: 10, color: TD, marginTop: 1, opacity: 0.75 }}>{s}</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

      </div>}

      {activeCardMissing && <div style={{ padding: "40px 24px 24px", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 360, background: SOFT_PANEL, border: `1px solid ${B}`, borderRadius: 16, padding: "24px 22px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><IconBadge name="refresh" size={38} color={A} /></div>
          <div style={{ fontFamily: FN, fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Session recovered</div>
          <div style={{ color: TD, fontSize: 13, lineHeight: 1.5, marginBottom: 18 }}>The session lost its place for a moment. AutoDeutsch is moving you to Results so you can continue safely.</div>
          <Btn bg={A} color="#0A0A0A" onClick={() => setScreen("results")} style={{ fontFamily: FN }}>Open Results</Btn>
        </div>
      </div>}

      {/* ── FLIP CARD SCREEN (vocab/production) ── */}
      {screen === "cards" && card && <div style={{ padding: "0 20px", height: "100vh", display: "flex", flexDirection: "column" }}>
        <Header extra={mode === "production" ? <span style={{ color: A, marginRight: 6 }}>EN→DE</span> : ""} />
        <ProgBar pct={((idx + 1) / cards.length) * 100} color={rpt > 0 ? R : A} />

        {mode === "production" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", opacity: vis ? 1 : 0, transition: "opacity 0.15s" }}>
            <div style={{ background: "linear-gradient(160deg, #121212 0%, #0E0E0E 100%)", border: `1px solid ${A}22`, borderRadius: 20, padding: "32px 24px", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", maxHeight: 320, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, #222 33%, ${R} 33% 66%, ${A} 66%)`, opacity: 0.7 }} />
              <div style={{ fontFamily: FN, fontSize: 28, fontWeight: 600, textAlign: "center", lineHeight: 1.25, color: T, letterSpacing: -0.3 }}>{card.en}</div>
              {answered && <>
                <div style={{ marginTop: 16, fontFamily: FN, fontSize: 22, fontWeight: 600, color: inputResult === "wrong" ? R : G, letterSpacing: -0.2 }}>{card.de}</div>
                {inputResult === "close" && <div style={{ fontSize: 11, color: A, marginTop: 4 }}>Close! Check spelling.</div>}
                <button onClick={() => speak(card.de)} style={{ background: "transparent", border: `1px solid ${A}44`, borderRadius: 999, padding: "5px 12px", color: A, fontSize: 11, cursor: "pointer", fontWeight: 600, marginTop: 10, opacity: 0.9, display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="volume" size={13} /> Hören</button>
                <SpeedBadge ms={lastElapsed} /><CardStats />
                <HintBtn hint={card.hint} />
                {showEx ? (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${B}`, textAlign: "center", maxWidth: "92%" }}>
                    <div style={{ fontSize: 13, color: TD, lineHeight: 1.55, fontStyle: "italic" }}>
                      {highlightExample(card.ex, card.de).map((p, i) => p.hl
                        ? <span key={i} style={{ color: A, fontWeight: 600, fontStyle: "normal" }}>{p.text}</span>
                        : <span key={i}>{p.text}</span>
                      )}
                    </div>
                    {card.exEn && <div style={{ fontSize: 11, color: TD, lineHeight: 1.45, marginTop: 5, opacity: 0.7 }}>{card.exEn}</div>}
                  </div>
                ) : <button onClick={() => setShowEx(true)} style={{ marginTop: 10, background: "transparent", border: "none", color: TD, fontSize: 10, cursor: "pointer", fontWeight: 600, opacity: 0.55, letterSpacing: 1.5, }}>Show example</button>}
              </>}
            </div>
            <div style={{ paddingTop: 16, paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}>
              {!answered ? <div style={{ display: "flex", gap: 8 }}>
                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && input.trim()) submitTyped(); }}
                  placeholder="Type in German…" autoFocus autoCapitalize="off" autoCorrect="off" spellCheck="false"
                  style={{ flex: 1, padding: "14px 16px", borderRadius: 12, border: `1px solid ${B}`, background: SH, color: T, fontSize: 16, fontFamily: BD, outline: "none" }} />
                <Btn bg={A} color="#0A0A0A" ariaLabel="Submit answer" onClick={submitTyped} style={{ width: "auto", padding: "14px 20px" }}>→</Btn>
              </div>
                : <Btn bg={SH} border={`1px solid ${B}`} onClick={nextCard}>{idx < cards.length - 1 ? "Next →" : "Results"}</Btn>}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div role={!flipped ? "button" : undefined} tabIndex={!flipped && vis ? 0 : -1} aria-label={!flipped ? "Reveal answer" : "Answer revealed"} onKeyDown={handleRevealKey} onClick={revealCard} style={{ flex: 1, perspective: 900, cursor: !flipped ? "pointer" : "default", maxHeight: 360, opacity: vis ? 1 : 0, transition: "opacity 0.15s" }}>
              <div style={{ width: "100%", height: "100%", transformStyle: "preserve-3d", transition: vis ? "transform 0.5s cubic-bezier(0.4,0,0.2,1)" : "none", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)", position: "relative" }}>
                <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", background: "linear-gradient(160deg, #141414 0%, #0E0E0E 100%)", border: `1px solid ${A}33`, borderRadius: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, #222 33%, ${R} 33% 66%, ${A} 66%)` }} />
                  <div style={{ fontFamily: FN, fontSize: 30, fontWeight: 600, textAlign: "center", lineHeight: 1.2, color: T, letterSpacing: -0.3 }}>{card.de}</div>
                  {card.diff && <div style={{ position: "absolute", top: 14, right: 16, fontSize: 9, color: card.diff === "hard" ? R : card.diff === "medium" ? A : G, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{card.diff}</div>}
                  <div style={{ position: "absolute", bottom: 18, fontSize: 11, color: TD, letterSpacing: 1, fontWeight: 600, opacity: 0.65 }}>Tap to reveal</div>
                </div>
                <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "linear-gradient(160deg, #141414 0%, #0E0E0E 100%)", border: `1px solid ${A}33`, borderRadius: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, #222 33%, ${R} 33% 66%, ${A} 66%)` }} />
                  <div style={{ fontFamily: FN, fontSize: 28, fontWeight: 600, textAlign: "center", lineHeight: 1.2, color: T, marginBottom: 18, letterSpacing: -0.3 }}>{card.en}</div>
                  <div style={{ fontFamily: FN, fontSize: 19, textAlign: "center", lineHeight: 1.3, color: A, fontWeight: 600, marginBottom: 6 }}>{card.de}</div>
                  <button onClick={e => { e.stopPropagation(); speak(card.de); }} style={{ background: "transparent", border: `1px solid ${A}44`, borderRadius: 999, padding: "5px 12px", color: A, fontSize: 11, cursor: "pointer", fontWeight: 600, marginBottom: 14, opacity: 0.9, display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="volume" size={13} /> Hören</button>
                  {answered && <><SpeedBadge ms={lastElapsed} /><CardStats /></>}
                  <HintBtn hint={card.hint} />
                  {showEx ? (
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${B}`, textAlign: "center", maxWidth: "92%" }}>
                      <div style={{ fontSize: 13, color: TD, lineHeight: 1.55, fontStyle: "italic" }}>
                        {highlightExample(card.ex, card.de).map((p, i) => p.hl
                          ? <span key={i} style={{ color: A, fontWeight: 600, fontStyle: "normal" }}>{p.text}</span>
                          : <span key={i}>{p.text}</span>
                        )}
                      </div>
                      {card.exEn && <div style={{ fontSize: 11, color: TD, lineHeight: 1.45, marginTop: 5, opacity: 0.7 }}>{card.exEn}</div>}
                    </div>
                  ) : flipped && <button onClick={e => { e.stopPropagation(); setShowEx(true); }} style={{ marginTop: 10, background: "transparent", border: "none", color: TD, fontSize: 10, cursor: "pointer", fontWeight: 600, opacity: 0.55, letterSpacing: 1.5, }}>Show example</button>}
                </div>
              </div>
            </div>
            <div style={{ paddingTop: 20, paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}>
              {flipped && !answered && <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => handleFlipAnswer(false)} style={{
                  flex: 1, padding: "18px 16px", borderRadius: 16,
                  background: `linear-gradient(180deg, ${R}14 0%, ${R}22 100%)`,
                  color: "#F87171", border: `1px solid ${R}44`,
                  fontSize: 16, fontWeight: 700, fontFamily: "inherit",
                  cursor: "pointer", letterSpacing: 0.3,
                  boxShadow: `inset 0 1px 0 ${R}33, 0 2px 4px rgba(0,0,0,0.35)`,
                  transition: "transform 0.1s, background 0.2s"
                }}>Again</button>
                <button onClick={() => handleFlipAnswer(true)} style={{
                  flex: 1, padding: "18px 16px", borderRadius: 16,
                  background: `linear-gradient(180deg, ${G}14 0%, ${G}22 100%)`,
                  color: "#86EFAC", border: `1px solid ${G}55`,
                  fontSize: 16, fontWeight: 700, fontFamily: "inherit",
                  cursor: "pointer", letterSpacing: 0.3,
                  boxShadow: `inset 0 1px 0 ${G}33, 0 2px 4px rgba(0,0,0,0.35)`,
                  transition: "transform 0.1s, background 0.2s"
                }}>Got it</button>
              </div>}
              {answered && <Btn bg={SH} border={`1px solid ${B}`} onClick={nextCard}>{idx < cards.length - 1 ? "Next →" : "Results"}</Btn>}
              {!flipped && vis && <div style={{ textAlign: "center", color: TD, fontSize: 12, paddingTop: 6 }}>Think of the answer, then tap</div>}
            </div>
          </div>
        )}
      </div>}

      {/* ── DRILL SCREEN (article/cloze/verb) ── */}
      {screen === "drill" && card && <div style={{ padding: "0 20px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Header extra={<span style={{ color: A, marginRight: 6 }}>{mode === "article" ? "der/die/das" : mode === "cloze" ? "Cloze" : mode === "imperativ" ? "Imperative" : mode === "listening" ? "Listening" : "Verb"}</span>} />
        <ProgBar pct={((idx + 1) / cards.length) * 100} color={rpt > 0 ? R : A} />

        <div style={{ opacity: vis ? 1 : 0, transition: "opacity 0.15s", flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ background: FGRAD, border: `1px solid ${A}22`, borderRadius: 20, padding: "28px 20px", marginBottom: 16, minHeight: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, #222 33%, ${R} 33% 66%, ${A} 66%)`, opacity: 0.7 }} />
            {mode === "article" && <>
              <div style={{ fontSize: 10, color: AD, letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>What article?</div>
              <div style={{ fontFamily: FN, fontSize: 26, textAlign: "center" }}>___ {card.noun}</div>
              <div style={{ fontSize: 12, color: TD, marginTop: 8 }}>({card.en})</div>
              {answered && <><div style={{ marginTop: 12, fontFamily: FN, fontSize: 20, color: sel !== null && ["der", "die", "das"][sel] === card.article ? G : R }}>{card.article} {card.noun}</div><SpeakBtn text={`${card.article} ${card.noun}`} /><SpeedBadge ms={lastElapsed} /><CardStats /></>}
            </>}
            {mode === "cloze" && <>
              <div style={{ fontSize: 10, color: AD, letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Fill the gap</div>
              <div style={{ fontFamily: FN, fontSize: 20, textAlign: "center", lineHeight: 1.4 }}>{answered ? card.q.replace("___", card.a) : card.q}</div>
              {answered && <div style={{ marginTop: 12, fontSize: 12, color: TD, textAlign: "center", lineHeight: 1.5, padding: "8px 14px", background: "#0A0A0A66", borderRadius: 10, borderLeft: `3px solid ${A}` }}>
                {inputResult === "wrong" ? <><span style={{ color: R }}>Your answer: {input}</span><br /><span style={{ color: G }}>Correct: {card.a}</span><br /></> :
                  <span style={{ color: G }}>Correct! ✓</span>}{" "}{card.h}
                <SpeedBadge ms={lastElapsed} /><CardStats />
              </div>}
            </>}
            {mode === "verb" && <>
              <div style={{ fontSize: 10, color: AD, letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Conjugate — {card.tense}</div>
              <div style={{ fontFamily: FN, fontSize: 22, color: A, marginBottom: 6 }}>{card.verb}</div>
              {card.tense === "Perfekt" ? <div style={{ fontSize: 15, color: T, fontWeight: 600 }}>{card.pron} ___ ___?</div>
                : <div style={{ fontSize: 15, color: T, fontWeight: 600 }}>{card.pron} ___?</div>}
              <div style={{ fontSize: 12, color: TD, marginTop: 4 }}>({card.en})</div>
              {answered && <><div style={{ marginTop: 12, fontSize: 13, color: G, fontWeight: 700 }}>{card.pron} {card.correct}</div>
                <div style={{ fontSize: 11, color: TD, marginTop: 4 }}>{card.hint}</div><SpeakBtn text={`${card.pron} ${card.correct}`} /><SpeedBadge ms={lastElapsed} /><CardStats /></>}
            </>}
            {mode === "imperativ" && <>
              <div style={{ fontSize: 10, color: AD, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>Imperative — {card._person === "sie" ? "Sie" : card._person}</div>
              <div style={{ fontFamily: FN, fontSize: 22, color: A, marginBottom: 4 }}>{card.base}</div>
              <div style={{ fontSize: 12, color: TD, marginBottom: 8 }}>({card.en})</div>
              {!answered && <div style={{ fontSize: 11, color: TD, textAlign: "center", fontStyle: "italic" }}>Give the {card._person === "sie" ? "Sie" : card._person}-form command</div>}
              {answered && <>
                <div style={{ marginTop: 10, width: "100%", maxWidth: 300, background: "#0A0A0A66", borderRadius: 10, padding: "10px 14px", borderLeft: `3px solid ${inputResult === "wrong" ? R : G}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                    <span style={{ color: TD }}>du</span>
                    <span style={{ color: card._person === "du" ? (inputResult === "wrong" ? R : G) : T, fontWeight: card._person === "du" ? 700 : 500 }}>{card.du}{card._person === "du" ? " ←" : ""}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                    <span style={{ color: TD }}>ihr</span>
                    <span style={{ color: card._person === "ihr" ? (inputResult === "wrong" ? R : G) : T, fontWeight: card._person === "ihr" ? 700 : 500 }}>{card.ihr}{card._person === "ihr" ? " ←" : ""}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                    <span style={{ color: TD }}>Sie</span>
                    <span style={{ color: card._person === "sie" ? (inputResult === "wrong" ? R : G) : T, fontWeight: card._person === "sie" ? 700 : 500 }}>{card.sie}{card._person === "sie" ? " ←" : ""}</span>
                  </div>
                </div>
                {inputResult === "wrong" && <div style={{ fontSize: 11, color: R, marginTop: 6 }}>You: {input}</div>}
                <div style={{ fontSize: 11, color: TD, marginTop: 8, fontStyle: "italic", textAlign: "center", padding: "0 6px" }}>„{card.ex}"</div>
                <div style={{ fontSize: 11, color: BL, marginTop: 4, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><Icon name="target" size={12} /> {card.hint}</div>
                <SpeakBtn text={card[card._person]} />
                <SpeedBadge ms={lastElapsed} /><CardStats />
              </>}
            </>}
            {mode === "listening" && card._dialogue && <>
              <div style={{ fontSize: 10, color: AD, letterSpacing: 3, textTransform: "uppercase", marginBottom: 10, fontWeight: 700 }}>Listening — {card._dialogue.title}</div>
              <div style={{ width: "100%", maxHeight: 160, overflowY: "auto", background: "#0A0A0A66", borderRadius: 10, padding: "10px 14px", marginBottom: 14, borderLeft: `3px solid ${A}` }}>
                {card._dialogue.lines.map((line, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    {line.speaker && <div style={{ fontSize: 9, color: AD, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{line.speaker}</div>}
                    <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                      <div style={{ fontSize: 12, color: T, lineHeight: 1.4, flex: 1 }}>{line.de}</div>
                      <button type="button" aria-label={`Play line ${i + 1}`} onClick={(e) => { e.stopPropagation(); speak(line.de); }} style={{ background: "none", border: "none", color: A, fontSize: 12, cursor: "pointer", flexShrink: 0, padding: 3 }}><Icon name="volume" size={14} /></button>
                    </div>
                  </div>
                ))}
                <button onClick={() => {
                  if (playAllActive) { stopPlayAll(); return; }
                  setPlayAllActive(true);
                  playAllTimersRef.current = [];
                  // Use a per-line delay proportional to character count (~70ms/char + 900ms base)
                  // rather than a fixed 2.8s — long lines used to cut off.
                  let cumulative = 0;
                  card._dialogue.lines.forEach((line, i, arr) => {
                    const delay = cumulative;
                    const t = setTimeout(() => {
                      speak(line.de);
                      if (i === arr.length - 1) {
                        // after final line finishes (~ line.de.length*70 + 600 ms), clear flag
                        const clearT = setTimeout(() => { playAllTimersRef.current = []; setPlayAllActive(false); }, line.de.length * 70 + 600);
                        playAllTimersRef.current.push(clearT);
                      }
                    }, delay);
                    playAllTimersRef.current.push(t);
                    cumulative += line.de.length * 70 + 900;
                  });
                }}
                  style={{ marginTop: 4, background: playAllActive ? `${R}22` : `${A}22`, border: `1px solid ${playAllActive ? R : A}55`, borderRadius: 8, padding: "5px 12px", color: playAllActive ? R : A, fontSize: 11, cursor: "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon name={playAllActive ? "pause" : "play"} size={13} /> {playAllActive ? "Stop" : "Play all"}
                </button>
              </div>
              <div style={{ fontFamily: FN, fontSize: 16, color: T, fontWeight: 700, textAlign: "center", lineHeight: 1.4 }}>{card.q}</div>
              {answered && <>
                <div style={{ fontSize: 11, color: sel === card.correctIdx ? G : R, marginTop: 8, fontWeight: 700 }}>
                  {sel === card.correctIdx ? "✓ Correct" : `✗ Correct: ${card.opts[card.correctIdx]}`}
                </div>
                <SpeedBadge ms={lastElapsed} /><CardStats />
              </>}
            </>}
          </div>

          {mode === "cloze" && !answered && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && input.trim()) submitCloze(); }}
                placeholder="Type answer…" autoFocus autoCapitalize="off" autoCorrect="off" spellCheck="false"
                style={{ flex: 1, padding: "14px 16px", borderRadius: 12, border: `1px solid ${B}`, background: SH, color: T, fontSize: 16, fontFamily: BD, outline: "none" }} />
              <Btn bg={A} color="#0A0A0A" ariaLabel="Submit answer" onClick={submitCloze} style={{ width: "auto", padding: "14px 20px" }}>→</Btn>
            </div>
          )}
          {mode === "imperativ" && !answered && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && input.trim()) { const target = card[card._person]; const result = checkMatch(input, target); setInputResult(result); setAnswered(true); record(result !== "wrong", card, Date.now() - tStart); speak(target); } }}
                placeholder={card._person === "sie" ? "e.g. kommen Sie" : "Type the imperative…"} autoFocus autoCapitalize="off" autoCorrect="off" spellCheck="false"
                style={{ flex: 1, padding: "14px 16px", borderRadius: 12, border: `1px solid ${B}`, background: SH, color: T, fontSize: 16, fontFamily: BD, outline: "none" }} />
              <Btn bg={A} color="#0A0A0A" ariaLabel="Submit answer" onClick={() => { if (!input.trim()) return; const target = card[card._person]; const result = checkMatch(input, target); setInputResult(result); setAnswered(true); record(result !== "wrong", card, Date.now() - tStart); speak(target); }} style={{ width: "auto", padding: "14px 20px" }}>→</Btn>
            </div>
          )}
          {mode === "listening" && !answered && card.opts && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
              {card.opts.map((opt, i) => <button key={i} onClick={() => handleDrillAnswer(i)} style={{ padding: "14px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", background: SH, border: `1px solid ${B}`, color: T, fontFamily: BD, textAlign: "left" }}>{opt}</button>)}
            </div>
          )}
          {mode === "listening" && answered && card.opts && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
              {card.opts.map((opt, i) => { const isC = i === card.correctIdx; const wasS = i === sel;
                return (<div key={i} style={{ padding: "14px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600, background: isC ? "#0A1A0A" : wasS ? "#1A0000" : SH, border: `2px solid ${isC ? G : wasS ? R : B}`, color: isC ? G : wasS ? R : TD, fontFamily: BD, textAlign: "left" }}>{opt}{isC ? " ✓" : wasS ? " ✗" : ""}</div>);
              })}
            </div>
          )}
          {mode === "article" && !answered && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {["der", "die", "das"].map((art, i) => <button key={i} onClick={() => handleDrillAnswer(i)} style={{ padding: "16px", borderRadius: 14, fontSize: 18, fontWeight: 700, cursor: "pointer", background: SH, border: `1px solid ${B}`, color: T, fontFamily: FN }}>{art}</button>)}
            </div>
          )}
          {mode === "article" && answered && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {["der", "die", "das"].map((art, i) => { const isC = art === card.article; const wasS = i === sel;
                return (<div key={i} style={{ padding: "16px", borderRadius: 14, fontSize: 18, fontWeight: 700, background: isC ? "#0A1A0A" : wasS ? "#1A0000" : SH, border: `2px solid ${isC ? G : wasS ? R : B}`, color: isC ? G : wasS ? R : TD, fontFamily: FN, textAlign: "center" }}>{art}{isC ? " ✓" : wasS ? " ✗" : ""}</div>);
              })}
            </div>
          )}
          {mode === "verb" && !answered && card.opts && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {card.opts.map((opt, i) => <button key={i} onClick={() => handleDrillAnswer(i)} style={{ padding: "14px", borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: "pointer", background: SH, border: `1px solid ${B}`, color: T, fontFamily: FN }}>{opt}</button>)}
            </div>
          )}
          {mode === "verb" && answered && card.opts && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {card.opts.map((opt, i) => { const isC = i === card.correctIdx; const wasS = i === sel;
                return (<div key={i} style={{ padding: "14px", borderRadius: 14, fontSize: 16, fontWeight: 700, background: isC ? "#0A1A0A" : wasS ? "#1A0000" : SH, border: `2px solid ${isC ? G : wasS ? R : B}`, color: isC ? G : wasS ? R : TD, fontFamily: FN, textAlign: "center" }}>{opt}{isC ? " ✓" : wasS ? " ✗" : ""}</div>);
              })}
            </div>
          )}
          {mode === "verb" && !answered && !card.opts && (
            <div style={{ display: "flex", gap: 8 }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && input.trim()) { setAnswered(true); const result = checkMatch(input, card.correct); setInputResult(result); record(result !== "wrong", card, Date.now() - tStart); } }}
                placeholder={`${card.pron} …`} autoFocus autoCapitalize="off" autoCorrect="off" spellCheck="false"
                style={{ flex: 1, padding: "14px 16px", borderRadius: 12, border: `1px solid ${B}`, background: SH, color: T, fontSize: 16, fontFamily: BD, outline: "none" }} />
              <Btn bg={A} color="#0A0A0A" ariaLabel="Submit answer" onClick={() => { if (!input.trim()) return; setAnswered(true); const result = checkMatch(input, card.correct); setInputResult(result); record(result !== "wrong", card, Date.now() - tStart); }} style={{ width: "auto", padding: "14px 20px" }}>→</Btn>
            </div>
          )}
          <div style={{ marginTop: "auto", paddingTop: 16, paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}>
            {answered && <Btn bg={SH} border={`1px solid ${B}`} onClick={nextDrill}>{idx < cards.length - 1 ? "Next →" : "Results"}</Btn>}
          </div>
        </div>
      </div>}

      {/* ── SENTENCE BUILDER ── */}
      {screen === "sentence" && card && <div style={{ padding: "0 20px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Header extra={<span style={{ color: BL, marginRight: 6 }}>Build</span>} />
        <ProgBar pct={((idx + 1) / cards.length) * 100} color={rpt > 0 ? R : BL} />
        <div style={{ opacity: vis ? 1 : 0, transition: "opacity 0.15s", flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ background: FGRAD, border: `1px solid ${A}22`, borderRadius: 20, padding: "24px 20px", marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: AD, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>Build the sentence</div>
            <div style={{ fontSize: 14, color: TD, marginBottom: 16, lineHeight: 1.4 }}>"{card.en}"</div>
            <div style={{ minHeight: 52, padding: "12px 14px", borderRadius: 12, border: `2px dashed ${sbChecked ? (sbCorrect ? G : R) : B}`, background: "#0A0A0A44", display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {sbPicked.length === 0 && <span style={{ color: TD, fontSize: 13, fontStyle: "italic" }}>Tap words below…</span>}
              {sbPicked.map((w, i) => <button key={i} onClick={() => sbUntapWord(w, i)} disabled={sbChecked} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: sbChecked ? "default" : "pointer", background: sbChecked ? (sbCorrect ? "#0A1A0A" : "#1A0000") : SH, border: `1px solid ${sbChecked ? (sbCorrect ? G : R) : A}`, color: sbChecked ? (sbCorrect ? G : R) : T }}>{w}</button>)}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {sbPool.map((w, i) => <button key={i} onClick={() => sbTapWord(w, i)} disabled={sbChecked} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: sbChecked ? "default" : "pointer", background: S, border: `1px solid ${B}`, color: T }}>{w}</button>)}
            </div>
            {sbChecked && <div style={{ marginTop: 16 }}>
              {!sbCorrect && <div style={{ fontSize: 13, color: G, fontWeight: 600, marginBottom: 6 }}>Correct: {card.correct.join(" ")}</div>}
              <div style={{ fontSize: 12, color: TD, padding: "8px 12px", background: "#0A0A0A66", borderRadius: 8, borderLeft: `3px solid ${BL}` }}>{card.rule}</div>
              <SpeakBtn text={card.correct.join(" ")} />
              <SpeedBadge ms={lastElapsed} /><CardStats />
            </div>}
          </div>
          <div style={{ marginTop: "auto", paddingTop: 8, paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}>
            {!sbChecked && sbPicked.length > 0 && <Btn bg={BL} color="#0A0A0A" onClick={sbCheck} style={{ fontFamily: FN }}>Check</Btn>}
            {sbChecked && <Btn bg={SH} border={`1px solid ${B}`} onClick={sbNext}>{idx < cards.length - 1 ? "Next →" : "Results"}</Btn>}
          </div>
        </div>
      </div>}

      {/* ── NEW: DIALOGUE SCREEN ── */}
      {screen === "dialogues" && <div style={{ padding: "0 20px", minHeight: "100vh" }}>
        {(() => {
          const pool = (cards && cards.length) ? cards : DIALOGUES;
          const dlg = pool[dlgIdx];
          if (!dlg) return null;
          return (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <button onClick={() => setScreen("home")} style={{ background: "none", border: "none", color: TD, fontSize: 14, cursor: "pointer" }}>← Back</button>
                <div style={{ fontSize: 12, color: TD, fontWeight: 600 }}>{dlgIdx + 1}/{pool.length}</div>
              </div>
              <div style={{ fontFamily: FN, fontSize: 22, marginBottom: 16 }}>{dlg.title}</div>
              {dlg.lines.map((line, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  {line.speaker && <div style={{ fontSize: 10, color: AD, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{line.speaker}</div>}
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ fontSize: 14, color: T, lineHeight: 1.5, flex: 1 }}>{line.de}</div>
                    <button type="button" aria-label={`Play line ${i + 1}`} onClick={() => speak(line.de)} style={{ background: "none", border: "none", color: A, fontSize: 14, cursor: "pointer", flexShrink: 0, padding: 3 }}><Icon name="volume" size={15} /></button>
                  </div>
                  <button onClick={() => { setDlgRevealed(r => ({ ...r, [i]: true })); speak(line.de); }} style={{ background: "none", border: "none", color: dlgRevealed[i] ? BL : TD, fontSize: 12, cursor: "pointer", padding: "4px 0", fontStyle: "italic" }}>
                    {dlgRevealed[i] ? line.en : "↳ tap to translate"}
                  </button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 10, marginTop: 24, paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
                {dlgIdx > 0 && <Btn bg={S} border={`1px solid ${B}`} onClick={() => { setDlgIdx(i => i - 1); setDlgRevealed({}); }} style={{ flex: 1 }}>← Prev</Btn>}
                {dlgIdx < pool.length - 1 && <Btn bg={A} color="#0A0A0A" onClick={() => { setDlgIdx(i => i + 1); setDlgRevealed({}); }} style={{ flex: 1 }}>Next →</Btn>}
                {dlgIdx === pool.length - 1 && <Btn bg={SH} border={`1px solid ${B}`} onClick={() => setScreen("home")} style={{ flex: 1 }}>Done</Btn>}
              </div>
            </>
          );
        })()}
      </div>}

      {/* ── AUDIO PLAYER SCREEN ── */}
      {screen === "audio" && <div style={{ padding: "max(16px, env(safe-area-inset-top)) 20px 0", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <button onClick={audioExit} style={{ background: "transparent", border: `1px solid ${A}33`, borderRadius: 10, color: A, fontSize: 13, cursor: "pointer", padding: "8px 14px", fontWeight: 600, letterSpacing: 0.3 }}>← Back</button>
          <div style={{ fontSize: 12, color: TD, fontWeight: 600 }}>{idx + 1} / {cards.length}</div>
        </div>
        <ProgBar pct={((idx + 1) / Math.max(cards.length, 1)) * 100} color={A} />

        {/* Card display — large, readable from a distance */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 0" }}>
          {cards[idx] && (
            <>
              <div style={{ fontSize: 10, color: AD, letterSpacing: 3, textTransform: "uppercase", marginBottom: 16, fontWeight: 700 }}>
                {category}
              </div>
              <div style={{ background: FGRAD, border: `1px solid ${A}22`, borderRadius: 20, padding: "40px 24px", width: "100%", textAlign: "center", marginBottom: 18 }}>
                <div style={{ fontFamily: FN, fontSize: 32, color: T, fontWeight: 700, marginBottom: 14, lineHeight: 1.2 }}>
                  {cards[idx].de}
                </div>
                <div style={{ fontSize: 18, color: A, fontWeight: 500, marginBottom: 8 }}>
                  {cards[idx].en}
                </div>
                {audioIncludeExample && cards[idx].ex && (
                  <div style={{ fontSize: 13, color: TD, fontStyle: "italic", marginTop: 16, lineHeight: 1.4 }}>
                    „{cards[idx].ex}"
                  </div>
                )}
                {cards[idx]._cat && cards[idx]._cat !== category && (
                  <div style={{ fontSize: 10, color: TD, marginTop: 14, letterSpacing: 1, textTransform: "uppercase" }}>
                    {cards[idx]._cat}
                  </div>
                )}
              </div>
              {/* Position dots */}
              <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap", justifyContent: "center", maxWidth: 280 }}>
                {cards.slice(Math.max(0, idx - 4), Math.min(cards.length, idx + 5)).map((_, i) => {
                  const realIdx = Math.max(0, idx - 4) + i;
                  return (
                    <div key={realIdx} style={{
                      width: realIdx === idx ? 20 : 6,
                      height: 6,
                      borderRadius: 3,
                      background: realIdx < idx ? G : realIdx === idx ? A : B,
                      transition: "all 0.3s"
                    }} />
                  );
                })}
              </div>
              {audioPlaying && (
                <div style={{ fontSize: 11, color: A, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="volume" size={13} /> Playing
                </div>
              )}
              {!audioPlaying && (
                <div style={{ fontSize: 11, color: TD, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="pause" size={13} /> Paused
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom controls — thumb reach */}
        <div style={{ paddingBottom: "max(28px, env(safe-area-inset-bottom))", paddingTop: 14 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center" }}>
            <button
              type="button"
              aria-label="Previous audio card"
              onClick={() => {
                if (idx > 0) {
                  const wasPlaying = audioPlayingRef.current;
                  audioPause();
                  setIdx(i => Math.max(0, i - 1));
                  if (wasPlaying) setTimeout(() => audioResume(), 120);
                }
              }}
              disabled={idx === 0}
              style={{ width: 56, height: 56, borderRadius: "50%", background: SH, border: `1px solid ${B}`, color: idx === 0 ? B : T, fontSize: 22, cursor: idx === 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="skipBack" size={22} />
            </button>
            <button
              type="button"
              aria-label={audioPlaying ? "Pause audio mode" : "Resume audio mode"}
              onClick={() => audioPlaying ? audioPause() : audioResume()}
              style={{ width: 72, height: 72, borderRadius: "50%", background: A, border: "none", color: "#0A0A0A", fontSize: 28, cursor: "pointer", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 20px ${A}44` }}>
              <Icon name={audioPlaying ? "pause" : "play"} size={28} stroke={2.2} />
            </button>
            <button
              type="button"
              aria-label="Next audio card"
              onClick={() => {
                const wasPlaying = audioPlayingRef.current;
                audioPause();
                if (idx + 1 < cards.length) {
                  setIdx(i => i + 1);
                  if (wasPlaying) setTimeout(() => audioResume(), 120);
                } else {
                  setScreen("results");
                  setStats({ c: cards.length, w: 0 });
                }
              }}
              style={{ width: 56, height: 56, borderRadius: "50%", background: SH, border: `1px solid ${B}`, color: T, fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="skipForward" size={22} />
            </button>
          </div>
          <div style={{ textAlign: "center", fontSize: 10, color: TD, marginTop: 14, letterSpacing: 1 }}>
            {audioEnFirst ? "EN → DE" : "DE → EN"} · {audioPauseLen / 1000}s pause
          </div>
        </div>
      </div>}

      {/* ── RESULTS ── */}
      {screen === "results" && <div style={{ padding: "40px 24px 24px", textAlign: "center" }}>
        <div style={{ height: 3, background: `linear-gradient(90deg, #222 33%, ${R} 33% 66%, ${A} 66%)`, borderRadius: 2, marginBottom: 24 }} />
        <div style={{ fontSize: 11, color: TD, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>{failed.length > 0 ? "Keep Going" : "Complete"}</div>
        <h2 style={{ fontFamily: FN, fontSize: 28, margin: "0 0 6px", fontWeight: 800, color: T }}>{failed.length > 0 ? "Almost There" : "Session Complete"}</h2>
        <p style={{ color: TD, fontSize: 13, marginBottom: 8 }}>
          {category}
          {rpt > 0 ? ` · Round ${rpt + 1}` : ""}
          {" · "}
          <span style={{ color: A, fontWeight: 600 }}>{mode === "vocab" ? "DE→EN" : mode === "production" ? "EN→DE" : mode === "article" ? "der/die/das" : mode === "cloze" ? "Cloze" : mode === "verb" ? "Verb" : mode === "sentence" ? "Sentence" : mode === "imperativ" ? "Imperative" : mode === "listening" ? "Listening" : mode === "audio" ? "Audio" : mode}</span>
        </p>
        {failed.length > 0 && <p style={{ color: R, fontSize: 13, marginBottom: 8, fontWeight: 700 }}>{failed.length} card{failed.length !== 1 ? "s" : ""} to repeat</p>}
        {failedNames.length > 0 && <div style={{ marginBottom: 20, padding: "12px 16px", background: SH, border: `1px solid ${R}33`, borderRadius: 14, textAlign: "left", maxHeight: 120, overflowY: "auto" }}>
          {failedNames.map((n, i) => (<div key={i} style={{ fontSize: 12, color: R, padding: "4px 0", borderBottom: i < failedNames.length - 1 ? `1px solid ${B}` : "none" }}>✗ {n}</div>))}
        </div>}
        {failed.length === 0 && <div style={{ height: 16 }} />}

        <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 28 }}>
          <div><div style={{ fontFamily: FN, fontSize: 48, color: G, fontWeight: 800 }}>{stats.c}</div><div style={{ fontSize: 10, color: TD, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Correct</div></div>
          <div style={{ width: 1, background: B }} />
          <div><div style={{ fontFamily: FN, fontSize: 48, color: R, fontWeight: 800 }}>{stats.w}</div><div style={{ fontSize: 10, color: TD, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Wrong</div></div>
        </div>

        {(stats.c + stats.w > 0) && <div style={{ width: 110, height: 110, borderRadius: "50%", border: `3px solid ${failed.length > 0 ? R : A}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", background: SH }}>
          <div style={{ fontFamily: FN, fontSize: 30, color: failed.length > 0 ? R : A, fontWeight: 800 }}>{Math.round((stats.c / (stats.c + stats.w)) * 100)}%</div>
          <div style={{ fontSize: 10, color: TD, fontWeight: 600 }}>accuracy</div>
        </div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {failed.length > 0 ? <Btn bg={R} color="#FFF" onClick={startRepeat} style={{ fontFamily: FN, fontSize: 15, fontWeight: 800 }}>Repeat {failed.length} Failed Card{failed.length !== 1 ? "s" : ""}</Btn>
            : <Btn bg={A} color="#0A0A0A" onClick={() => setScreen("home")} style={{ fontFamily: FN, fontSize: 15, fontWeight: 800 }}>Weiter</Btn>}
          <Btn bg={SH} border={`1px solid ${B}`} onClick={() => setScreen("home")} style={{ fontWeight: 600 }}>Back to Home</Btn>
        </div>
      </div>}
    </div>
  );
}


ReactDOM.createRoot(document.getElementById('root')).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
