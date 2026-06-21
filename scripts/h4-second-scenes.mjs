// H4 — multi-scene content depth. Adds a second dialogue scene to single-scene missions and wires
// its title into the mission's `dialogues` array. Idempotent: skips any title already present.
// Run: node scripts/h4-second-scenes.mjs   (then `npm run validate` + build).
import { readFileSync, writeFileSync } from "fs";

// Each entry: { mission, existing (the mission's current sole dialogue title), dlg }.
// dlg matches the DIALOGUES schema: { title, level, lines:[{de,en}], questions:[{q,opts,correctIdx}] }.
const SCENES = [
  // ── paperwork ──
  { mission: "steuerid", existing: "Steuer-ID und Lohnsteuer", dlg: {
    title: "Die Steuererklärung — Geld zurück", level: "B1",
    lines: [
      { de: "Lohnt sich eine Steuererklärung für mich überhaupt?", en: "Is a tax return even worth it for me?" },
      { de: "Oft ja — viele Angestellte bekommen am Ende Geld zurück.", en: "Often yes — many employees get money back in the end." },
      { de: "Was kann ich denn absetzen?", en: "What can I deduct, then?" },
      { de: "Zum Beispiel die Fahrt zur Arbeit, Arbeitsmittel und Versicherungen.", en: "For example the commute to work, work equipment and insurance." },
      { de: "Muss ich das auf Papier machen?", en: "Do I have to do it on paper?" },
      { de: "Nein, online über Elster geht es am einfachsten.", en: "No, it's easiest online via Elster." },
      { de: "Bis wann muss ich sie abgeben?", en: "By when do I have to submit it?" },
      { de: "Freiwillig hast du bis zu vier Jahre Zeit.", en: "Voluntarily you have up to four years." },
    ],
    questions: [
      { q: "Was bekommen viele Angestellte nach der Steuererklärung?", opts: ["Geld zurück", "Eine Strafe", "Einen neuen Ausweis"], correctIdx: 0 },
      { q: "Wie gibt man die Erklärung am einfachsten ab?", opts: ["Per Fax", "Online über Elster", "Mündlich"], correctIdx: 1 },
    ],
  }},
  { mission: "license", existing: "Den Führerschein umschreiben", dlg: {
    title: "Brauche ich eine Fahrprüfung?", level: "B1",
    lines: [
      { de: "Hängt es vom Land ab, ob ich eine Prüfung machen muss?", en: "Does it depend on the country whether I have to take a test?" },
      { de: "Genau. Bei manchen Ländern wird der Führerschein einfach umgeschrieben.", en: "Exactly. For some countries the licence is simply transferred." },
      { de: "Und bei meinem?", en: "And for mine?" },
      { de: "Da brauchen Sie leider die theoretische und die praktische Prüfung.", en: "There you unfortunately need the theory and the practical test." },
      { de: "Kann ich trotzdem schon fahren?", en: "Can I still drive in the meantime?" },
      { de: "In den ersten sechs Monaten ja, danach nicht mehr.", en: "In the first six months yes, after that no longer." },
      { de: "Wo melde ich mich für die Prüfung an?", en: "Where do I register for the test?" },
      { de: "Am besten über eine Fahrschule, die organisiert alles.", en: "Best through a driving school; it organises everything." },
    ],
    questions: [
      { q: "Wovon hängt die Prüfungspflicht ab?", opts: ["Vom Alter", "Vom Herkunftsland", "Vom Wohnort"], correctIdx: 1 },
      { q: "Wie lange darf man anfangs noch fahren?", opts: ["Sechs Monate", "Zwei Jahre", "Gar nicht"], correctIdx: 0 },
    ],
  }},
  { mission: "fuehrungszeugnis", existing: "Ein Führungszeugnis beantragen", dlg: {
    title: "Das Führungszeugnis für den Arbeitgeber", level: "B1",
    lines: [
      { de: "Mein neuer Arbeitgeber verlangt ein Führungszeugnis. Welches brauche ich?", en: "My new employer wants a certificate of good conduct. Which one do I need?" },
      { de: "Für eine Privatfirma reicht das einfache Führungszeugnis.", en: "For a private company the simple certificate is enough." },
      { de: "Und wenn ich mit Kindern arbeite?", en: "And if I work with children?" },
      { de: "Dann brauchen Sie das erweiterte Führungszeugnis.", en: "Then you need the extended certificate." },
      { de: "Wird es direkt an die Firma geschickt?", en: "Is it sent directly to the company?" },
      { de: "Nein, es kommt zu Ihnen nach Hause, und Sie geben es weiter.", en: "No, it comes to your home and you pass it on." },
      { de: "Wie lange dauert das?", en: "How long does that take?" },
      { de: "Etwa ein bis zwei Wochen nach dem Antrag.", en: "About one to two weeks after the application." },
    ],
    questions: [
      { q: "Welches Zeugnis braucht man für die Arbeit mit Kindern?", opts: ["Das einfache", "Das erweiterte", "Gar keins"], correctIdx: 1 },
      { q: "Wohin wird das Führungszeugnis geschickt?", opts: ["Zur Firma", "Nach Hause", "Zur Polizei"], correctIdx: 1 },
    ],
  }},
  { mission: "finanzamt", existing: "Anruf beim Finanzamt", dlg: {
    title: "Einspruch gegen den Steuerbescheid", level: "B2",
    lines: [
      { de: "Ich habe meinen Steuerbescheid bekommen und finde ihn nicht korrekt.", en: "I've received my tax assessment and I don't think it's correct." },
      { de: "Dann können Sie innerhalb eines Monats Einspruch einlegen.", en: "Then you can file an objection within one month." },
      { de: "Reicht dafür ein formloses Schreiben?", en: "Is an informal letter enough for that?" },
      { de: "Ja, aber begründen Sie genau, womit Sie nicht einverstanden sind.", en: "Yes, but state precisely what you disagree with." },
      { de: "Welche Belege soll ich beilegen?", en: "Which supporting documents should I enclose?" },
      { de: "Alles, was Ihre Angaben stützt — Rechnungen, Nachweise, Bescheinigungen.", en: "Everything that backs up your figures — invoices, proofs, certificates." },
      { de: "Muss ich die Nachzahlung trotzdem leisten?", en: "Do I still have to make the back-payment?" },
      { de: "Der Einspruch hemmt die Zahlung nicht automatisch; das müssen Sie extra beantragen.", en: "The objection doesn't automatically suspend payment; you have to request that separately." },
    ],
    questions: [
      { q: "Wie lange hat man Zeit für den Einspruch?", opts: ["Einen Monat", "Ein Jahr", "Eine Woche"], correctIdx: 0 },
      { q: "Was sollte der Einspruch enthalten?", opts: ["Nur den Namen", "Eine genaue Begründung", "Ein Foto"], correctIdx: 1 },
    ],
  }},
  { mission: "strom", existing: "Strom anmelden", dlg: {
    title: "Die Stromabrechnung und die Nachzahlung", level: "B2",
    lines: [
      { de: "Ich habe meine Jahresabrechnung bekommen und soll nachzahlen. Warum?", en: "I got my annual statement and I'm supposed to pay extra. Why?" },
      { de: "Ihr Verbrauch lag über dem geschätzten Abschlag.", en: "Your consumption was above the estimated monthly instalment." },
      { de: "Wird mein monatlicher Abschlag jetzt angepasst?", en: "Will my monthly instalment be adjusted now?" },
      { de: "Ja, er wird etwas erhöht, damit es nächstes Jahr passt.", en: "Yes, it's raised a little so it fits next year." },
      { de: "Kann ich den Anbieter wechseln, wenn er zu teuer ist?", en: "Can I switch provider if it's too expensive?" },
      { de: "Natürlich, achten Sie nur auf die Kündigungsfrist im Vertrag.", en: "Of course, just watch the notice period in the contract." },
      { de: "Wo finde ich meinen Zählerstand?", en: "Where do I find my meter reading?" },
      { de: "Auf dem Stromzähler; den geben Sie einmal im Jahr durch.", en: "On the electricity meter; you report it once a year." },
    ],
    questions: [
      { q: "Warum muss der Kunde nachzahlen?", opts: ["Er hat zu wenig verbraucht", "Der Verbrauch lag über dem Abschlag", "Der Zähler ist kaputt"], correctIdx: 1 },
      { q: "Worauf muss man beim Anbieterwechsel achten?", opts: ["Auf die Kündigungsfrist", "Auf die Hausnummer", "Auf das Wetter"], correctIdx: 0 },
    ],
  }},
  { mission: "auslander", existing: "Termin bei der Ausländerbehörde", dlg: {
    title: "Den Aufenthaltstitel verlängern", level: "B2",
    lines: [
      { de: "Mein Aufenthaltstitel läuft bald ab. Wann soll ich die Verlängerung beantragen?", en: "My residence permit expires soon. When should I apply for the extension?" },
      { de: "Am besten zwei bis drei Monate vorher, sonst wird es knapp.", en: "Best two to three months beforehand, otherwise it gets tight." },
      { de: "Welche Unterlagen muss ich mitbringen?", en: "Which documents do I have to bring?" },
      { de: "Pass, Arbeitsvertrag, Gehaltsnachweise und den Nachweis über die Wohnung.", en: "Passport, employment contract, proof of salary and proof of accommodation." },
      { de: "Brauche ich auch einen Nachweis über Deutschkenntnisse?", en: "Do I also need proof of German skills?" },
      { de: "Je nach Titel ja, oft das Niveau B1.", en: "Depending on the permit yes, often level B1." },
      { de: "Was passiert, wenn der alte Titel vorher abläuft?", en: "What happens if the old permit expires first?" },
      { de: "Sie bekommen eine Fiktionsbescheinigung, die Ihren Aufenthalt überbrückt.", en: "You get a provisional certificate that bridges your stay." },
    ],
    questions: [
      { q: "Wann sollte man die Verlängerung beantragen?", opts: ["Zwei bis drei Monate vorher", "Am letzten Tag", "Nach dem Ablauf"], correctIdx: 0 },
      { q: "Was überbrückt den Aufenthalt bei Verzögerung?", opts: ["Ein Visum", "Eine Fiktionsbescheinigung", "Ein Touristenticket"], correctIdx: 1 },
    ],
  }},
  // ── roof ──
  { mission: "viewing", existing: "Wohnungsbesichtigung mit vielen Bewerbern", dlg: {
    title: "Die Bewerbungsmappe für die Wohnung", level: "B1",
    lines: [
      { de: "Wie hebe ich mich bei so vielen Bewerbern ab?", en: "How do I stand out among so many applicants?" },
      { de: "Bringen Sie eine vollständige Mappe gleich zur Besichtigung mit.", en: "Bring a complete folder straight to the viewing." },
      { de: "Was gehört da hinein?", en: "What goes in it?" },
      { de: "Die Mieterselbstauskunft, eine Schufa-Auskunft und die letzten Gehaltsnachweise.", en: "The tenant self-disclosure, a Schufa report and your last payslips." },
      { de: "Soll ich auch eine Bürgschaft anbieten?", en: "Should I also offer a guarantee?" },
      { de: "Wenn Sie eine bekommen können, hilft das auf jeden Fall.", en: "If you can get one, it definitely helps." },
      { de: "Und eine Mietschuldenfreiheitsbescheinigung?", en: "And a certificate of freedom from rent debts?" },
      { de: "Vom Vorvermieter — gern, das macht einen guten Eindruck.", en: "From your previous landlord — sure, that makes a good impression." },
    ],
    questions: [
      { q: "Was sollte man zur Besichtigung mitbringen?", opts: ["Eine vollständige Bewerbungsmappe", "Nur den Ausweis", "Nichts"], correctIdx: 0 },
      { q: "Was gehört in die Mappe?", opts: ["Urlaubsfotos", "Schufa und Gehaltsnachweise", "Ein Lebenslauf des Vermieters"], correctIdx: 1 },
    ],
  }},
  { mission: "givenotice", existing: "Die Wohnung kündigen", dlg: {
    title: "Die Wohnungsübergabe beim Auszug", level: "B1",
    lines: [
      { de: "Bei der Übergabe — muss ich die Wohnung frisch streichen?", en: "At the handover — do I have to repaint the flat?" },
      { de: "Nur wenn es im Vertrag steht und die Wände wirklich nötig sind.", en: "Only if it's in the contract and the walls really need it." },
      { de: "Machen wir ein Übergabeprotokoll?", en: "Are we doing a handover protocol?" },
      { de: "Ja, da halten wir die Zählerstände und eventuelle Schäden fest.", en: "Yes, in it we record the meter readings and any damage." },
      { de: "Wann bekomme ich meine Kaution zurück?", en: "When do I get my deposit back?" },
      { de: "Meistens innerhalb von sechs Monaten, nach der Nebenkostenabrechnung.", en: "Usually within six months, after the utility-cost statement." },
      { de: "Soll ich alle Schlüssel abgeben?", en: "Should I hand over all the keys?" },
      { de: "Ja, jeden einzelnen — sonst gibt es Abzüge.", en: "Yes, every single one — otherwise there are deductions." },
    ],
    questions: [
      { q: "Was wird im Übergabeprotokoll festgehalten?", opts: ["Zählerstände und Schäden", "Das Wetter", "Die Nachbarn"], correctIdx: 0 },
      { q: "Wann kommt die Kaution oft zurück?", opts: ["Sofort", "Innerhalb von sechs Monaten", "Nie"], correctIdx: 1 },
    ],
  }},
  { mission: "contract", existing: "Discussing a rental contract", dlg: {
    title: "Die Klauseln im Mietvertrag", level: "B2",
    lines: [
      { de: "Im Vertrag steht „Staffelmiete“. Was bedeutet das genau?", en: "The contract says 'graduated rent'. What does that mean exactly?" },
      { de: "Die Miete steigt zu festgelegten Zeitpunkten um einen vereinbarten Betrag.", en: "The rent rises at fixed points in time by an agreed amount." },
      { de: "Und was sind Schönheitsreparaturen?", en: "And what are cosmetic repairs?" },
      { de: "Kleine Arbeiten wie Streichen; manche Klauseln dazu sind aber unwirksam.", en: "Small jobs like painting; but some clauses about them are invalid." },
      { de: "Wie lange ist die Kündigungsfrist für mich?", en: "How long is the notice period for me?" },
      { de: "In der Regel drei Monate zum Monatsende.", en: "As a rule three months to the end of the month." },
      { de: "Darf der Vermieter einfach die Miete erhöhen?", en: "Can the landlord just raise the rent?" },
      { de: "Nur in den gesetzlichen Grenzen und mit Begründung, etwa dem Mietspiegel.", en: "Only within the legal limits and with justification, such as the rent index." },
    ],
    questions: [
      { q: "Was ist eine Staffelmiete?", opts: ["Eine Miete, die zu festen Zeitpunkten steigt", "Eine einmalige Gebühr", "Die Kaution"], correctIdx: 0 },
      { q: "Wie lange ist die Kündigungsfrist meist?", opts: ["Drei Monate", "Zwei Wochen", "Ein Jahr"], correctIdx: 0 },
    ],
  }},
  // ── money ──
  { mission: "nebenkosten", existing: "Die Nebenkostenabrechnung", dlg: {
    title: "Widerspruch gegen die Nebenkosten", level: "B1",
    lines: [
      { de: "Meine Nachzahlung kommt mir viel zu hoch vor.", en: "My back-payment seems far too high to me." },
      { de: "Haben Sie die einzelnen Posten schon geprüft?", en: "Have you already checked the individual items?" },
      { de: "Die Heizkosten sind doppelt so hoch wie letztes Jahr.", en: "The heating costs are twice as high as last year." },
      { de: "Dann sollten Sie Einsicht in die Belege verlangen.", en: "Then you should ask to see the receipts." },
      { de: "Wie lange habe ich Zeit für einen Widerspruch?", en: "How long do I have for an objection?" },
      { de: "Zwölf Monate ab Erhalt der Abrechnung.", en: "Twelve months from receiving the statement." },
      { de: "Muss ich erst einmal zahlen?", en: "Do I have to pay first?" },
      { de: "Den unstrittigen Teil ja, den Rest können Sie zurückhalten.", en: "The undisputed part yes; the rest you can withhold." },
    ],
    questions: [
      { q: "Was sollte der Mieter zuerst prüfen?", opts: ["Die einzelnen Posten", "Das Wetter", "Den Nachbarn"], correctIdx: 0 },
      { q: "Wie lange hat man Zeit für den Widerspruch?", opts: ["Zwölf Monate", "Eine Woche", "Fünf Jahre"], correctIdx: 0 },
    ],
  }},
  { mission: "internet", existing: "Internet outage hotline", dlg: {
    title: "Der Techniker-Termin", level: "B2",
    lines: [
      { de: "Die Störung lässt sich aus der Ferne nicht beheben. Wir schicken einen Techniker.", en: "The fault can't be fixed remotely. We'll send a technician." },
      { de: "Wann hätte er denn Zeit?", en: "When would he have time, then?" },
      { de: "Übermorgen zwischen acht und zwölf Uhr.", en: "The day after tomorrow between eight and twelve." },
      { de: "Das ist ein langes Zeitfenster. Muss ich die ganze Zeit zu Hause sein?", en: "That's a long window. Do I have to be home the whole time?" },
      { de: "Leider ja, sonst verfällt der Termin.", en: "Unfortunately yes, otherwise the appointment lapses." },
      { de: "Und wenn am Ende mein Router kaputt ist?", en: "And what if my router turns out to be broken?" },
      { de: "Dann tauscht der Techniker ihn kostenlos aus.", en: "Then the technician replaces it free of charge." },
      { de: "Bekomme ich für den Ausfall eine Gutschrift?", en: "Do I get a credit for the outage?" },
      { de: "Das prüfen wir und ziehen es von der nächsten Rechnung ab.", en: "We'll check that and deduct it from the next bill." },
    ],
    questions: [
      { q: "Warum kommt ein Techniker?", opts: ["Die Störung geht aus der Ferne nicht weg", "Der Kunde zieht um", "Zur Werbung"], correctIdx: 0 },
      { q: "Was passiert mit einem kaputten Router?", opts: ["Er wird kostenlos getauscht", "Man muss ihn kaufen", "Nichts"], correctIdx: 0 },
    ],
  }},
  { mission: "insurance", existing: "Reporting an insurance claim", dlg: {
    title: "Welche Versicherung brauche ich?", level: "B2",
    lines: [
      { de: "Welche Versicherung ist in Deutschland wirklich wichtig?", en: "Which insurance is really important in Germany?" },
      { de: "Auf jeden Fall die private Haftpflichtversicherung.", en: "Definitely private liability insurance." },
      { de: "Wofür ist die genau da?", en: "What exactly is that for?" },
      { de: "Sie zahlt, wenn Sie versehentlich anderen einen Schaden zufügen.", en: "It pays if you accidentally cause damage to others." },
      { de: "Und eine Hausratversicherung?", en: "And a household contents insurance?" },
      { de: "Sinnvoll — sie ersetzt Ihre Sachen bei Einbruch, Feuer oder Wasser.", en: "Sensible — it replaces your belongings in case of burglary, fire or water." },
      { de: "Kann ich eine Police monatlich kündigen?", en: "Can I cancel a policy monthly?" },
      { de: "Meist gilt ein Jahr mit drei Monaten Kündigungsfrist.", en: "Usually it's one year with three months' notice." },
    ],
    questions: [
      { q: "Wofür zahlt die Haftpflichtversicherung?", opts: ["Wenn man anderen Schaden zufügt", "Für den Urlaub", "Für die Miete"], correctIdx: 0 },
      { q: "Was deckt die Hausratversicherung ab?", opts: ["Sachen bei Einbruch, Feuer oder Wasser", "Das Auto", "Die Gesundheit"], correctIdx: 0 },
    ],
  }},
  { mission: "carworkshop", existing: "At the car workshop", dlg: {
    title: "Kostenvoranschlag und TÜV", level: "B2",
    lines: [
      { de: "Können Sie mir vorab einen Kostenvoranschlag machen?", en: "Can you give me a cost estimate in advance?" },
      { de: "Klar. Die Bremsen kosten etwa dreihundert Euro mit Einbau.", en: "Sure. The brakes cost about three hundred euros including fitting." },
      { de: "In zwei Wochen ist auch der TÜV fällig.", en: "The TÜV inspection is also due in two weeks." },
      { de: "Dann prüfen wir das Auto gleich auf die Hauptuntersuchung.", en: "Then we'll check the car for the main inspection right away." },
      { de: "Was ist, wenn etwas nicht durchkommt?", en: "What if something doesn't pass?" },
      { de: "Kleine Mängel beheben wir sofort, dann gibt es die Plakette.", en: "We fix small defects immediately, then you get the sticker." },
      { de: "Bekomme ich einen Ersatzwagen?", en: "Do I get a replacement car?" },
      { de: "Für einen Tag ja, den können Sie kostenlos haben.", en: "For one day yes, you can have it free of charge." },
    ],
    questions: [
      { q: "Was möchte der Kunde vorab?", opts: ["Einen Kostenvoranschlag", "Einen Kaffee", "Ein neues Auto"], correctIdx: 0 },
      { q: "Was ist in zwei Wochen fällig?", opts: ["Der TÜV", "Die Miete", "Der Urlaub"], correctIdx: 0 },
    ],
  }},
  // ── health ──
  { mission: "specialist", existing: "Termin beim Facharzt", dlg: {
    title: "In der Facharztpraxis", level: "B1",
    lines: [
      { de: "Guten Tag, ich habe einen Termin und eine Überweisung von meinem Hausarzt.", en: "Hello, I have an appointment and a referral from my GP." },
      { de: "Die Überweisung und Ihre Versichertenkarte, bitte.", en: "The referral and your insurance card, please." },
      { de: "Hier, bitte. Muss ich noch etwas ausfüllen?", en: "Here you go. Do I have to fill out anything else?" },
      { de: "Nur diesen Bogen zu Ihrer Krankengeschichte.", en: "Just this form about your medical history." },
      { de: "Wie lange muss ich heute warten?", en: "How long do I have to wait today?" },
      { de: "Etwa zwanzig Minuten, der Arzt ruft Sie auf.", en: "About twenty minutes; the doctor will call you in." },
      { de: "Kann ich danach gleich einen Folgetermin machen?", en: "Can I make a follow-up appointment right after?" },
      { de: "Ja, das machen wir direkt an der Anmeldung.", en: "Yes, we'll do that right at reception." },
    ],
    questions: [
      { q: "Was legt der Patient an der Anmeldung vor?", opts: ["Überweisung und Versichertenkarte", "Einen Pass", "Ein Rezept"], correctIdx: 0 },
      { q: "Was füllt der Patient aus?", opts: ["Einen Bogen zur Krankengeschichte", "Einen Mietvertrag", "Eine Steuererklärung"], correctIdx: 0 },
    ],
  }},
  { mission: "emergency", existing: "In der Notaufnahme", dlg: {
    title: "Den Notruf wählen", level: "B1",
    lines: [
      { de: "Notruf, was ist passiert?", en: "Emergency services, what happened?" },
      { de: "Mein Nachbar ist gestürzt und reagiert nicht richtig.", en: "My neighbour has fallen and isn't responding properly." },
      { de: "Atmet er noch?", en: "Is he still breathing?" },
      { de: "Ja, aber er ist sehr benommen.", en: "Yes, but he's very dazed." },
      { de: "Wie ist die genaue Adresse?", en: "What's the exact address?" },
      { de: "Gartenstraße zwölf, dritter Stock.", en: "Gartenstraße twelve, third floor." },
      { de: "Bleiben Sie bei ihm, der Rettungswagen ist unterwegs.", en: "Stay with him, the ambulance is on its way." },
      { de: "Soll ich die Haustür schon öffnen?", en: "Should I open the front door already?" },
      { de: "Ja, und legen Sie nicht auf, bis ich es sage.", en: "Yes, and don't hang up until I tell you to." },
    ],
    questions: [
      { q: "Was fragt der Notruf zuerst nach dem Zustand?", opts: ["Ob er noch atmet", "Den Beruf", "Das Alter des Anrufers"], correctIdx: 0 },
      { q: "Was soll der Anrufer nicht tun?", opts: ["Auflegen, bevor es gesagt wird", "Bei ihm bleiben", "Die Tür öffnen"], correctIdx: 0 },
    ],
  }},
  { mission: "results", existing: "Discussing test results", dlg: {
    title: "Die nächsten Schritte besprechen", level: "B2",
    lines: [
      { de: "Die Werte sind insgesamt in Ordnung, nur das Eisen ist zu niedrig.", en: "The values are fine overall, only the iron is too low." },
      { de: "Was bedeutet das für mich?", en: "What does that mean for me?" },
      { de: "Daher kommt wahrscheinlich Ihre Müdigkeit. Wir behandeln das mit Tabletten.", en: "That's probably where your tiredness comes from. We'll treat it with tablets." },
      { de: "Muss ich auf meine Ernährung achten?", en: "Do I have to watch my diet?" },
      { de: "Ja, eisenhaltige Lebensmittel helfen zusätzlich.", en: "Yes, iron-rich foods help on top of that." },
      { de: "Brauche ich eine Überweisung zu einem Spezialisten?", en: "Do I need a referral to a specialist?" },
      { de: "Vorerst nicht. Wir kontrollieren das Blut in drei Monaten noch einmal.", en: "Not for now. We'll check the blood again in three months." },
      { de: "Soll ich vorher Bescheid geben, wenn es schlimmer wird?", en: "Should I let you know beforehand if it gets worse?" },
      { de: "Unbedingt, dann holen wir den Termin vor.", en: "Definitely, then we'll bring the appointment forward." },
    ],
    questions: [
      { q: "Welcher Wert ist zu niedrig?", opts: ["Das Eisen", "Der Blutdruck", "Der Zucker"], correctIdx: 0 },
      { q: "Wann wird das Blut wieder kontrolliert?", opts: ["In drei Monaten", "Morgen", "In zehn Jahren"], correctIdx: 0 },
    ],
  }},
  { mission: "sick", existing: "Krankmeldung im Büro", dlg: {
    title: "Beim Arzt krankschreiben lassen", level: "B2",
    lines: [
      { de: "Ich fühle mich seit zwei Tagen schlapp und habe Fieber.", en: "I've felt weak for two days and have a fever." },
      { de: "Dann schreibe ich Sie erst einmal für drei Tage krank.", en: "Then I'll sign you off sick for three days to start with." },
      { de: "Wird die Krankschreibung automatisch an meinen Arbeitgeber geschickt?", en: "Is the sick note sent to my employer automatically?" },
      { de: "Die elektronische Meldung geht an die Krankenkasse; den Arbeitgeber informieren Sie selbst.", en: "The electronic notification goes to the health insurer; you inform the employer yourself." },
      { de: "Und wenn es länger dauert?", en: "And if it lasts longer?" },
      { de: "Dann kommen Sie wieder, und wir verlängern die Krankschreibung.", en: "Then you come back and we extend the sick note." },
      { de: "Ab wann braucht mein Chef überhaupt ein Attest?", en: "From when does my boss actually need a certificate?" },
      { de: "Oft ab dem vierten Tag, aber manche verlangen es schon ab dem ersten.", en: "Often from the fourth day, but some require it from the first." },
    ],
    questions: [
      { q: "Wohin geht die elektronische Krankmeldung?", opts: ["An die Krankenkasse", "An die Polizei", "An den Vermieter"], correctIdx: 0 },
      { q: "Ab wann braucht der Chef oft ein Attest?", opts: ["Ab dem vierten Tag", "Nie", "Erst nach einem Monat"], correctIdx: 0 },
    ],
  }},
  // ── job ──
  { mission: "apply", existing: "Telefonische Nachfrage zur Bewerbung", dlg: {
    title: "Die Einladung zum Vorstellungsgespräch", level: "B1",
    lines: [
      { de: "Guten Tag, wir haben uns Ihre Bewerbung angesehen und laden Sie gern ein.", en: "Hello, we've looked at your application and would be glad to invite you." },
      { de: "Das freut mich sehr! Wann würde es Ihnen passen?", en: "I'm very pleased! When would suit you?" },
      { de: "Geht bei Ihnen Donnerstag um zehn Uhr?", en: "Does Thursday at ten work for you?" },
      { de: "Donnerstag passt gut. Wo finde ich Sie?", en: "Thursday works well. Where do I find you?" },
      { de: "Im zweiten Stock, melden Sie sich bitte am Empfang.", en: "On the second floor; please check in at reception." },
      { de: "Soll ich Unterlagen mitbringen?", en: "Should I bring any documents?" },
      { de: "Ihre Zeugnisse im Original wären gut.", en: "Your certificates in the original would be good." },
      { de: "Mache ich. Vielen Dank für die Einladung!", en: "Will do. Thank you very much for the invitation!" },
    ],
    questions: [
      { q: "Worauf einigen sich beide?", opts: ["Auf Donnerstag um zehn", "Auf eine Absage", "Auf ein Telefoninterview"], correctIdx: 0 },
      { q: "Was soll der Bewerber mitbringen?", opts: ["Die Zeugnisse im Original", "Einen Kuchen", "Nichts"], correctIdx: 0 },
    ],
  }},
  { mission: "firstday", existing: "Onboarding: erster Arbeitstag", dlg: {
    title: "Fragen in der Probezeit", level: "B2",
    lines: [
      { de: "Darf ich in der Probezeit eigentlich viele Fragen stellen?", en: "Am I actually allowed to ask a lot of questions during the probation period?" },
      { de: "Unbedingt, gerade am Anfang erwartet das niemand anders.", en: "Absolutely; especially at the start nobody expects otherwise." },
      { de: "An wen wende ich mich bei fachlichen Problemen?", en: "Who do I turn to with technical problems?" },
      { de: "Erst an mich, und sonst an die Kollegin am Nebenplatz.", en: "First to me, and otherwise to the colleague at the next desk." },
      { de: "Wie bekomme ich Rückmeldung zu meiner Arbeit?", en: "How do I get feedback on my work?" },
      { de: "Wir machen nach vier Wochen ein erstes Feedbackgespräch.", en: "We'll have a first feedback meeting after four weeks." },
      { de: "Worauf wird in der Probezeit besonders geachtet?", en: "What's looked at especially during the probation period?" },
      { de: "Auf Zuverlässigkeit und darauf, ob Sie ins Team passen.", en: "On reliability and whether you fit into the team." },
    ],
    questions: [
      { q: "Wie steht der Chef zu Fragen am Anfang?", opts: ["Sie sind ausdrücklich erwünscht", "Sie stören", "Sie sind verboten"], correctIdx: 0 },
      { q: "Worauf wird in der Probezeit geachtet?", opts: ["Zuverlässigkeit und Teamfähigkeit", "Die Kleidung", "Das Auto"], correctIdx: 0 },
    ],
  }},
  // ── belonging ──
  { mission: "verein", existing: "Im Sportverein anmelden", dlg: {
    title: "Das erste Training", level: "B1",
    lines: [
      { de: "Hallo, ich bin neu im Verein und heute zum ersten Mal beim Training.", en: "Hi, I'm new to the club and at training for the first time today." },
      { de: "Schön, dass du da bist! Hast du schon Sportsachen dabei?", en: "Great that you're here! Have you got your sports kit with you?" },
      { de: "Ja. Wie läuft so ein Training ab?", en: "Yes. How does a training session go?" },
      { de: "Erst wärmen wir uns auf, dann üben wir, am Ende spielen wir.", en: "First we warm up, then we practise, at the end we play." },
      { de: "Wie oft trainiert ihr in der Woche?", en: "How often do you train per week?" },
      { de: "Zweimal, dienstags und donnerstags um sieben.", en: "Twice, Tuesdays and Thursdays at seven." },
      { de: "Gibt es nach dem Training noch etwas Gemeinsames?", en: "Is there anything social after training?" },
      { de: "Oft gehen wir noch zusammen etwas trinken, komm gern mit.", en: "We often go for a drink together afterwards; feel free to join." },
    ],
    questions: [
      { q: "Wie läuft das Training ab?", opts: ["Aufwärmen, üben, spielen", "Nur reden", "Sofort nach Hause"], correctIdx: 0 },
      { q: "Wie oft wird trainiert?", opts: ["Zweimal pro Woche", "Jeden Tag", "Einmal im Monat"], correctIdx: 0 },
    ],
  }},
  { mission: "integrationskurs", existing: "Sich für einen Integrationskurs anmelden", dlg: {
    title: "Der Test am Ende des Kurses", level: "B1",
    lines: [
      { de: "Wie schließt der Integrationskurs eigentlich ab?", en: "How does the integration course actually finish?" },
      { de: "Mit zwei Prüfungen: dem Sprachtest und dem Orientierungstest.", en: "With two exams: the language test and the orientation test." },
      { de: "Welches Sprachniveau muss ich erreichen?", en: "Which language level do I have to reach?" },
      { de: "Das Ziel ist B1; damit gilt der Kurs als bestanden.", en: "The goal is B1; with that the course counts as passed." },
      { de: "Was wird im Orientierungstest gefragt?", en: "What is asked in the orientation test?" },
      { de: "Fragen zu Politik, Geschichte und dem Leben in Deutschland.", en: "Questions about politics, history and life in Germany." },
      { de: "Und wenn ich nicht bestehe?", en: "And if I don't pass?" },
      { de: "Dann kannst du den Test einmal kostenlos wiederholen.", en: "Then you can repeat the test once free of charge." },
    ],
    questions: [
      { q: "Welches Niveau ist das Ziel?", opts: ["B1", "C2", "A1"], correctIdx: 0 },
      { q: "Worum geht es im Orientierungstest?", opts: ["Politik, Geschichte, Leben in Deutschland", "Mathematik", "Sport"], correctIdx: 0 },
    ],
  }},
  { mission: "networking", existing: "Networking at a conference", dlg: {
    title: "Nach der Konferenz in Kontakt bleiben", level: "B2",
    lines: [
      { de: "Unser Gespräch vorhin war wirklich spannend. Sollen wir in Kontakt bleiben?", en: "Our conversation earlier was really interesting. Shall we stay in touch?" },
      { de: "Gern. Haben Sie eine Visitenkarte?", en: "Gladly. Do you have a business card?" },
      { de: "Die sind mir leider ausgegangen, aber vernetzen wir uns auf LinkedIn.", en: "I've unfortunately run out, but let's connect on LinkedIn." },
      { de: "Perfekt, ich schicke Ihnen gleich eine Anfrage.", en: "Perfect, I'll send you a request right away." },
      { de: "Worüber wollten wir noch einmal genauer sprechen?", en: "What did we want to talk about in more detail again?" },
      { de: "Über eine mögliche Zusammenarbeit bei Ihrem Projekt.", en: "About possible cooperation on your project." },
      { de: "Genau. Passt Ihnen nächste Woche ein kurzer Videocall?", en: "Exactly. Would a short video call next week suit you?" },
      { de: "Ja, schlagen Sie einfach zwei Termine vor.", en: "Yes, just suggest two time slots." },
    ],
    questions: [
      { q: "Wie wollen sie in Kontakt bleiben?", opts: ["Über LinkedIn", "Per Brief", "Gar nicht"], correctIdx: 0 },
      { q: "Was wird für nächste Woche vorgeschlagen?", opts: ["Ein kurzer Videocall", "Ein Urlaub", "Ein Umzug"], correctIdx: 0 },
    ],
  }},
  { mission: "kaffeekueche", existing: "Smalltalk in der Kaffeeküche", dlg: {
    title: "Zusammen Mittagessen gehen", level: "B2",
    lines: [
      { de: "Wir wollten gleich zusammen Mittagessen gehen. Kommst du mit?", en: "We were about to go to lunch together. Want to come?" },
      { de: "Gern! Wo geht ihr denn hin?", en: "Gladly! Where are you going?" },
      { de: "Zum Italiener um die Ecke, da ist es schnell und gut.", en: "To the Italian around the corner; it's quick and good there." },
      { de: "Klingt super. Ist es sehr teuer?", en: "Sounds great. Is it very expensive?" },
      { de: "Der Mittagstisch ist günstig, meistens unter zehn Euro.", en: "The lunch menu is cheap, usually under ten euros." },
      { de: "Habt ihr eine feste Mittagszeit?", en: "Do you have a fixed lunch time?" },
      { de: "So gegen halb eins, aber das ist ganz locker.", en: "Around half past twelve, but it's quite relaxed." },
      { de: "Dann schließe ich mich euch ab jetzt öfter an.", en: "Then I'll join you more often from now on." },
    ],
    questions: [
      { q: "Wohin gehen die Kollegen?", opts: ["Zum Italiener um die Ecke", "Nach Hause", "Ins Kino"], correctIdx: 0 },
      { q: "Wie viel kostet der Mittagstisch meist?", opts: ["Unter zehn Euro", "Über fünfzig Euro", "Nichts"], correctIdx: 0 },
    ],
  }},
  { mission: "debate", existing: "Diskussion: Elektroautos", dlg: {
    title: "Diskussion: Homeoffice oder Büro", level: "B2",
    lines: [
      { de: "Ich finde, wir sollten dauerhaft mehr im Homeoffice arbeiten dürfen.", en: "I think we should be allowed to work from home more on a permanent basis." },
      { de: "Da bin ich anderer Meinung; im Büro arbeitet das Team besser zusammen.", en: "I disagree; the team works together better in the office." },
      { de: "Das stimmt teilweise, aber zu Hause bin ich konzentrierter.", en: "That's partly true, but at home I'm more focused." },
      { de: "Verstehe ich, trotzdem fehlt der spontane Austausch.", en: "I understand, but still the spontaneous exchange is missing." },
      { de: "Könnten wir uns nicht auf ein Mischmodell einigen?", en: "Couldn't we agree on a hybrid model?" },
      { de: "Zwei Tage Büro, drei Tage zu Hause — das wäre ein guter Kompromiss.", en: "Two days office, three days home — that would be a good compromise." },
      { de: "Einverstanden, aber feste Bürotage für Besprechungen.", en: "Agreed, but fixed office days for meetings." },
      { de: "Damit kann ich gut leben.", en: "I can live with that." },
    ],
    questions: [
      { q: "Welchen Kompromiss schlagen sie vor?", opts: ["Ein Mischmodell aus Büro und Homeoffice", "Nur Büro", "Gar nicht arbeiten"], correctIdx: 0 },
      { q: "Wofür sollen feste Bürotage sein?", opts: ["Für Besprechungen", "Für die Mittagspause", "Für den Urlaub"], correctIdx: 0 },
    ],
  }},
];

// ── splice ──
const FILE = "src/data.js";
let src = readFileSync(FILE, "utf8");
const fmtLines = (ls) => ls.map(l => `    {de:${JSON.stringify(l.de)},en:${JSON.stringify(l.en)}},`).join("\n");
const fmtQs = (qs) => qs.map(q => `    {q:${JSON.stringify(q.q)},opts:[${q.opts.map(o => JSON.stringify(o)).join(",")}],correctIdx:${q.correctIdx}},`).join("\n");
let added = 0, wired = 0, skipped = 0;
for (const s of SCENES) {
  const { dlg } = s;
  if (src.includes(`title:${JSON.stringify(dlg.title)}`) || src.includes(`"title": ${JSON.stringify(dlg.title)}`)) { skipped++; continue; }
  const obj = `  {\n    title:${JSON.stringify(dlg.title)}, level:${JSON.stringify(dlg.level)},\n    lines:[\n${fmtLines(dlg.lines)}\n    ],\n    questions:[\n${fmtQs(dlg.questions)}\n    ],\n  },\n`;
  // Insert right after the DIALOGUES opening line (order within the array is irrelevant).
  const anchor = "const DIALOGUES = [\n";
  const at = src.indexOf(anchor);
  if (at < 0) throw new Error("DIALOGUES anchor not found");
  src = src.slice(0, at + anchor.length) + obj + src.slice(at + anchor.length);
  added++;
  // Wire the title into the mission's dialogues array.
  const needle = `dialogues:["${s.existing}"]`;
  if (!src.includes(needle)) throw new Error(`mission dialogues not found for ${s.mission}: ${needle}`);
  src = src.replace(needle, `dialogues:["${s.existing}",${JSON.stringify(dlg.title)}]`);
  wired++;
}
writeFileSync(FILE, src);
console.log(`added ${added} dialogues, wired ${wired} missions, skipped ${skipped} (already present)`);
