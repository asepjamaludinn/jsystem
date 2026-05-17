export const fetchWeatherByCity = async (city) => {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "API Key cuaca belum dikonfigurasi di environment variables.",
    );
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric&lang=id`;

  const response = await fetch(url);
  const weatherData = await response.json();

  if (Number(weatherData.cod) !== 200) {
    const error = new Error(
      weatherData.message ||
        "Gagal mengambil data cuaca dari penyedia layanan.",
    );
    error.statusCode = weatherData.cod;
    throw error;
  }

  return weatherData;
};
