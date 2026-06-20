export interface Article {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  imageUrl: string;
}

export const articles: Article[] = [
  {
    slug: 'klimatyzacja-jako-tanie-ogrzewanie',
    title: 'Klimatyzacja jako tanie ogrzewanie zimą',
    excerpt: 'Nowoczesne klimatyzatory to pełnoprawne pompy ciepła powietrze-powietrze. Dowiedz się, dlaczego ogrzewanie klimatyzacją jest opłacalne.',
    date: '15.11.2025',
    imageUrl: 'https://txaizdqdpxpvodmkagqn.supabase.co/storage/v1/object/sign/bazawiedzy/ogrzewanie.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV85ODk1ZWUxMS0zNmVmLTQyMTctYjJiOS1mNWI1OTA4Y2Y2ZmQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJiYXphd2llZHp5L29ncnpld2FuaWUucG5nIiwic2NvcGUiOiJkb3dubG9hZCIsImlhdCI6MTc4MTkzNzEyMCwiZXhwIjoyMDk3Mjk3MTIwfQ._FOfsbtsMZgh5lvDRWRS-3O2TcgoYGfoE89RkLMpRew',
    content: `
<h2>Dlaczego ogrzewanie klimatyzacją się opłaca?</h2>
<p>Kluczem do zrozumienia opłacalności tego rozwiązania jest współczynnik <strong>SCOP</strong> (Seasonal Coefficient of Performance). Określa on, ile energii cieplnej urządzenie jest w stanie wyprodukować z 1 kW pobranej energii elektrycznej. W przypadku nowoczesnych urządzeń SCOP często przekracza wartość 4.0. Oznacza to, że pobierając 1 kW prądu, klimatyzator oddaje do pomieszczenia ponad 4 kW ciepła!</p>

<h3>Nowe jednostki z grzałką tacy ociekowej</h3>
<p>Jeśli planujesz ogrzewać mieszkanie klimatyzatorem w trakcie zimy, kluczowy jest wybór odpowiedniego sprzętu. Warto zainwestować w modele dedykowane do pracy całorocznej, wyposażone w <strong>grzałkę karteru sprężarki oraz grzałkę tacy ociekowej</strong>.</p>
<ul>
  <li><strong>Grzałka karteru:</strong> Zapewnia odpowiednią temperaturę oleju w sprężarce, co ułatwia start urządzenia przy niskich temperaturach zewnętrznych i przedłuża żywotność kompresora.</li>
  <li><strong>Grzałka tacy ociekowej:</strong> Zapobiega zamarzaniu skroplin na dnie jednostki zewnętrznej. Bez niej nagromadzony lód mógłby uszkodzić wentylator lub wymiennik ciepła.</li>
</ul>

<h2>Wygoda i szybkość działania</h2>
<p>Klimatyzator nagrzewa pomieszczenie błyskawicznie. W przeciwieństwie do tradycyjnych grzejników, które potrzebują czasu na nagrzanie zładu wody, jednostka ścienna od razu nadmuchuje ciepłe powietrze. To idealne rozwiązanie do dogrzewania salonu rano lub po powrocie z pracy.</p>

<h2>Podsumowanie</h2>
<p>Ogrzewanie klimatyzacją to nowoczesny, tani i ekologiczny sposób na komfort termiczny zimą. Jeśli rozważasz montaż klimatyzacji, pomyśl o niej jak o inwestycji w komfort całoroczny. Nowoczesne jednostki z wbudowanymi grzałkami bez problemu poradzą sobie nawet w temperaturach sięgających -20°C.</p>
    `
  },
  {
    slug: 'warunki-utrzymania-gwarancji-i-serwis',
    title: 'Utrzymanie gwarancji a regularny serwis klimatyzacji',
    excerpt: 'Dlaczego coroczny przegląd klimatyzacji to nie tylko wymóg gwarancyjny, ale też inwestycja w zdrowie i dłuższą żywotność sprzętu.',
    date: '02.04.2026',
    imageUrl: 'https://txaizdqdpxpvodmkagqn.supabase.co/storage/v1/object/sign/bazawiedzy/serwis.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV85ODk1ZWUxMS0zNmVmLTQyMTctYjJiOS1mNWI1OTA4Y2Y2ZmQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJiYXphd2llZHp5L3Nlcndpcy5wbmciLCJzY29wZSI6ImRvd25sb2FkIiwiaWF0IjoxNzgxOTM3MTAyLCJleHAiOjIwOTcyOTcxMDJ9.knPrTygLi2tQxVlPngl25FfK0Rd3hqah30AQT3vo90k',
    content: `
<h2>Warunek gwarancji: Przegląd co najmniej raz w roku</h2>
<p>Większość renomowanych producentów (w tym Fuji Electric, Haier czy Mitsubishi) uzależnia utrzymanie gwarancji (zazwyczaj od 3 do 5 lat) od wykonywania autoryzowanych przeglądów. Standardowo wymaga się wykonania serwisu <strong>co najmniej raz w roku</strong>, a w przypadku klimatyzatorów pracujących ciągle w trudnych warunkach (np. serwerownie, sklepy) – nawet dwa razy do roku.</p>
<p>Jeżeli urządzenie ulegnie awarii, a Ty nie będziesz posiadać dokumentacji poświadczającej regularne serwisowanie (np. wpisu w karcie gwarancyjnej lub protokołu), serwis producenta najprawdopodobniej odrzuci zgłoszenie z tytułu rękojmi lub gwarancji.</p>

<h2>Dlaczego przegląd jest tak ważny dla klimatyzatora?</h2>
<p>Serwis to nie tylko przysłowiowe "podbicie pieczątki". Podczas wizyty technik instalator sprawdza szereg krytycznych parametrów:</p>
<ol>
  <li><strong>Szczelność układu chłodniczego:</strong> Niewielkie ubytki czynnika (freonu) powodują spadek wydajności i obciążają sprężarkę, co może prowadzić do jej zatarcia.</li>
  <li><strong>Drożność układu skroplin:</strong> Zatkany odpływ wody to najczęstsza przyczyna cieknącego klimatyzatora i zalanych ścian w lecie.</li>
  <li><strong>Parametry elektryczne i ciśnienia:</strong> Kontrola pracy elektroniki sterującej zapobiega nagłym awariom w szczycie sezonu.</li>
</ol>

<h2>Zdrowie użytkownika – najważniejszy powód</h2>
<p>Klimatyzator to doskonałe środowisko do rozwoju drobnoustrojów. Wilgoć na wymienniku ciepła sprzyja powstawaniu grzybów i pleśni. Brak czyszczenia i dezynfekcji oznacza, że te zanieczyszczenia będą nawiewane prosto do Twojego salonu.</p>
<p>Regularne odgrzybianie jednostki wewnętrznej oraz czyszczenie i wymiana filtrów to <strong>gwarancja czystego powietrza</strong> i bezpieczeństwa dla dróg oddechowych Twojej rodziny.</p>

<h2>Pamiętamy za Ciebie!</h2>
<p>W KlikKlima doskonale wiemy, że w natłoku codziennych spraw łatwo zapomnieć o przeglądzie. Dlatego wprowadziliśmy system opieki posprzedażowej:</p>
<ul>
  <li><strong>Po każdym montażu przypominamy się z propozycją przeglądu</strong> przed rozpoczęciem sezonu chłodniczego lub grzewczego.</li>
  <li>Udostępniamy <strong>system rezerwacji online</strong>, w którym wygodnie, kilkoma kliknięciami, wybierzesz termin wizyty serwisu – bez dzwonienia i czekania.</li>
</ul>
<p>Dbaj o swój komfort, a formalności zostaw nam!</p>
    `
  },
  {
    slug: 'historia-fuji-electric-i-klimatyzatory',
    title: 'Historia marki Fuji: Od przemysłu do chłodu w Twoim domu',
    excerpt: 'Poznaj fascynującą historię giganta japońskiego przemysłu – firmy Fuji, oraz jej drogę do stworzenia niezawodnych klimatyzatorów do mieszkań.',
    date: '10.05.2026',
    imageUrl: 'https://txaizdqdpxpvodmkagqn.supabase.co/storage/v1/object/sign/bazawiedzy/fuji.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV85ODk1ZWUxMS0zNmVmLTQyMTctYjJiOS1mNWI1OTA4Y2Y2ZmQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJiYXphd2llZHp5L2Z1amkuanBnIiwic2NvcGUiOiJkb3dubG9hZCIsImlhdCI6MTc4MTkzNzE0NSwiZXhwIjoyMDk3Mjk3MTQ1fQ.ayzGLR_EWZEdE26a5kV_Ly41G7K7azsr_yH7sTLX36U',
    content: `
<h2>Początki giganta: Narodziny Fuji Electric</h2>
<p>Historia marki rozpoczyna się w 1923 roku w Japonii. Firma Fuji Electric Company została założona jako spółka joint-venture między japońskim <em>Furukawa Electric</em>, a niemieckim gigantem przemysłowym <em>Siemens AG</em>. Samo słowo "Fuji" wzięło się z połączenia pierwszej litery obu firm: "Fu" (Furukawa) oraz "Ji" (japońska wymowa litery "S" od Siemens: <em>jiimensu</em>). Oczywiście nazwa kojarzyła się również ze świętą japońską górą – symbolem siły i doskonałości.</p>
<p>Przez dekady Fuji Electric specjalizowało się w ciężkim przemyśle, energetyce, produkcji generatorów, układów scalonych, a nawet ogromnych turbin do elektrowni wodnych. To potężne doświadczenie w inżynierii automatyki przemysłowej i elektroniki stało się fundamentem ich późniejszych sukcesów w sprzęcie dla domu.</p>

<h2>Wejście w segment HVAC</h2>
<p>Z biegiem lat, wykorzystując swoje kompetencje w budowie potężnych silników elektrycznych i systemów sterowania (falowników), Fuji weszło na rynek systemów chłodniczych i klimatyzacyjnych.</p>
<p>Klimatyzatory <strong>Fuji Electric</strong> to urządzenia produkowane w ramach japońskiej korporacji w fabrykach, gdzie nacisk kładzie się na "przemysłową" trwałość.</p>

<h2>Ciekawostki o klimatyzatorach Fuji</h2>
<ul>
  <li><strong>Przemysłowe serce w domowej obudowie:</strong> Dzięki doświadczeniu w napędach elektrycznych, sprężarki i elektronika inwerterowa w domowych klimatyzatorach Fuji należą do najbardziej precyzyjnych i wytrzymałych na rynku. Znoszą ogromne skrajności temperatur.</li>
  <li><strong>Bracia bliźniacy:</strong> Warto wiedzieć, że marka Fuji Electric współpracuje w ramach jednego konsorcjum z innym japońskim gigantem – Fujitsu General. Urządzenia tych obu marek bardzo często schodzą z tych samych taśm produkcyjnych i dzielą ze sobą najlepsze technologie.</li>
  <li><strong>Cicha praca jako priorytet:</strong> Japonia to kraj małych mieszkań i gęstej zabudowy. Dlatego inżynierowie Fuji od dekad udoskonalają systemy redukcji hałasu. Ich nowoczesne konstrukcje wentylatorów potrafią zejść z głośnością do ledwie 20 dB – to cichszy szept niż liście na wietrze!</li>
</ul>

<h2>Dlaczego montujemy Fuji w KlikKlima?</h2>
<p>Nasz proces wyceny i standardy montażu opieramy na urządzeniach bezawaryjnych. Klimatyzatory Fuji Electric doskonale wpisują się w tę filozofię. Montując je u naszych klientów, wiemy, że system przepracuje wiele lat bez usterki, co pozwala nam ze spokojem udzielać wydłużonej 5-letniej gwarancji. Wybierając Fuji, masz pewność, że japońska technologia przemysłowa chroni komfort Twojego salonu.</p>
    `
  }
];
