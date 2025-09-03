// API Configuration
const API_KEY = "71763bd65e82b728671f5aab18811aa2";
let currentUnit = 'imperial';
let currentCityData = null;
let weatherChart = null;
let favorites = [];

// DOM Elements
const cityInput = document.getElementById('cityInput');
const weatherForm = document.getElementById('weatherForm');
const loading = document.getElementById('loading');
const weatherContainer = document.getElementById('weatherContainer');
const unitButtons = document.querySelectorAll('.unit-btn');

// New Features Variables
let comparisonCities = [];
let isComparisonMode = false;

// Initialize particles animation
function createParticles() {
    const particles = document.getElementById('particles');
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 6 + 's';
        particles.appendChild(particle);
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    createParticles();
    updateCurrentDate();
});

// Update current date
function updateCurrentDate() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', options);
}

// Unit toggle functionality
unitButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        unitButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentUnit = btn.dataset.unit;
        
        const cityName = document.getElementById('cityName').textContent;
        if (cityName && cityName !== 'City Name') {
            searchCity(cityName);
        }
    });
});

// Separate function to update chart data
function updateChartWithData(type) {
    if (!weatherChart || !currentCityData) return;
    
    const forecastData = currentCityData.forecast.list.slice(0, 8);
    let data, label, color;
    const unit = currentUnit === 'imperial' ? '°F' : '°C';
    
    switch(type) {
        case 'temperature':
            data = forecastData.map(item => item.main.temp);
            label = `Temperature (${unit})`;
            color = 'rgba(255, 99, 132, 1)';
            break;
        case 'humidity':
            data = forecastData.map(item => item.main.humidity);
            label = 'Humidity (%)';
            color = 'rgba(54, 162, 235, 1)';
            break;
        case 'pressure':
            data = forecastData.map(item => item.main.pressure);
            label = 'Pressure (hPa)';
            color = 'rgba(255, 206, 86, 1)';
            break;
        default:
            return;
    }
    
    weatherChart.data.datasets[0] = {
        label: label,
        data: data,
        borderColor: color,
        backgroundColor: color.replace('1)', '0.1)'),
        tension: 0.4,
        fill: true,
        borderWidth: 3,
        pointBackgroundColor: color,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8
    };
    weatherChart.update('active');
}

// City input with suggestions
let suggestionTimeout;
cityInput.addEventListener('input', function() {
    clearTimeout(suggestionTimeout);
    const query = this.value.trim();
    
    if (query.length > 2) {
        suggestionTimeout = setTimeout(() => {
            getCitySuggestions(query);
        }, 300);
    } else {
        clearSuggestions();
    }
});

// Get city suggestions
async function getCitySuggestions(query) {
    try {
        const sanitizedQuery = encodeURIComponent(query.replace(/[<>]/g, ''));
        const response = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${sanitizedQuery}&limit=5&appid=${API_KEY}`);
        if (!response.ok) throw new Error('Failed to fetch suggestions');
        
        const suggestions = await response.json();
        showSuggestions(suggestions);
    } catch (error) {
        console.error('Error fetching suggestions:', error);
    }
}

// Show suggestions dropdown 
function showSuggestions(suggestions) {
    clearSuggestions();
    
    if (suggestions.length === 0) return;

    const suggestionsList = document.createElement('ul');
    suggestionsList.className = 'suggestions';
    
    suggestions.forEach(city => {
        const li = document.createElement('li');
        const cityName = city.name.replace(/[<>]/g, '');
        const country = city.country.replace(/[<>]/g, '');
        const state = city.state ? city.state.replace(/[<>]/g, '') : '';
        
        li.innerHTML = `
            <i class="fas fa-map-marker-alt"></i> 
            ${cityName}, ${country}
            ${state ? `, ${state}` : ''}
        `;
        li.addEventListener('click', () => {
            cityInput.value = cityName;
            clearSuggestions();
            searchCity(cityName);
        });
        suggestionsList.appendChild(li);
    });
    
    cityInput.parentElement.appendChild(suggestionsList);
}

// Clear suggestions
function clearSuggestions() {
    const existing = document.querySelector('.suggestions');
    if (existing) existing.remove();
}

// Form submission
weatherForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const city = cityInput.value.trim();
    if (city) {
        searchCity(city);
        clearSuggestions();
    }
});

// Search city function
async function searchCity(cityName) {
    showLoading(true);
    try {
        const weatherData = await getWeatherData(cityName);
        displayWeatherData(weatherData);
        showLoading(false);
        weatherContainer.style.display = 'block';
        weatherContainer.classList.add('fade-in');
        
        if (currentCityData && isComparisonMode) {
            addToComparison(currentCityData);
        }
        
        // Add to favorites button in current weather
        addFavoriteButton();
    } catch (error) {
        showLoading(false);
        showError(error.message);
    }
}

// Get current location 
function getCurrentLocation() {
    if (navigator.geolocation) {
        showLoading(true);
        const options = {
            timeout: 10000,
            enableHighAccuracy: true,
            maximumAge: 300000
        };
        
        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const { latitude, longitude } = position.coords;
                const weatherData = await getWeatherDataByCoords(latitude, longitude);
                displayWeatherData(weatherData);
                showLoading(false);
                weatherContainer.style.display = 'block';
                weatherContainer.classList.add('fade-in');
                addFavoriteButton();
            } catch (error) {
                showLoading(false);
                showError(error.message);
            }
        }, () => {
            showLoading(false);
            showError('Location access denied. Please search for a city manually.');
        }, options);
    } else {
        showError('Geolocation is not supported by this browser.');
    }
}

// Fetch weather data by city name 
async function getWeatherData(cityName) {
    try {
        // Get coordinates
        const sanitizedCityName = encodeURIComponent(cityName.replace(/[<>]/g, ''));
        const geoResponse = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${sanitizedCityName}&limit=1&appid=${API_KEY}`);
        if (!geoResponse.ok) throw new Error('Failed to find location');
        
        const geoData = await geoResponse.json();
        if (geoData.length === 0) throw new Error('City not found');
        
        const { lat, lon } = geoData[0];
        return await getWeatherDataByCoords(lat, lon);
    } catch (error) {
        throw new Error(`Unable to fetch weather data: ${error.message}`);
    }
}

// Fetch weather data by coordinates 
async function getWeatherDataByCoords(lat, lon) {
    const units = currentUnit;
    
    try {
        // Current weather
        const currentResponse = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${API_KEY}`);
        if (!currentResponse.ok) throw new Error('Failed to fetch current weather');
        
        // 5-day forecast
        const forecastResponse = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${API_KEY}`);
        if (!forecastResponse.ok) throw new Error('Failed to fetch forecast');
        
        const currentWeather = await currentResponse.json();
        const forecastData = await forecastResponse.json();
        
        return { current: currentWeather, forecast: forecastData };
    } catch (error) {
        throw new Error(`API Error: ${error.message}`);
    }
}

// Display weather data
function displayWeatherData(data) {
    const { current, forecast } = data;
    currentCityData = data;
    
    // Update current weather
    document.getElementById('cityName').textContent = current.name;
    document.getElementById('weatherDescription').textContent = current.weather[0].description;
    document.getElementById('weatherEmoji').textContent = getWeatherEmoji(current.weather[0].id);
    
    const tempUnit = currentUnit === 'imperial' ? '°F' : '°C';
    const windUnit = currentUnit === 'imperial' ? 'mph' : 'm/s';
    
    document.getElementById('temperature').textContent = `${Math.round(current.main.temp)}${tempUnit}`;
    document.getElementById('feelsLike').textContent = `Feels like ${Math.round(current.main.feels_like)}${tempUnit}`;
    document.getElementById('humidity').textContent = current.main.humidity;
    document.getElementById('windSpeed').textContent = Math.round(current.wind?.speed || 0);
    document.getElementById('pressure').textContent = current.main.pressure;
    document.getElementById('visibility').textContent = Math.round((current.visibility || 10000) / 1000);
    document.getElementById('uvIndex').textContent = '—'; // UV Index not available in current API
    document.getElementById('cloudiness').textContent = current.clouds.all;
    
    // Update wind speed unit
    const windSpeedLabel = document.querySelector('#windSpeed').nextElementSibling;
    if (windSpeedLabel) {
        windSpeedLabel.textContent = `Wind Speed (${windUnit})`;
    }
    
    // Display forecast
    displayForecast(forecast.list);
    
    // Load additional features
    loadAirQuality(current.coord.lat, current.coord.lon);
    loadWeatherAlerts(current.coord.lat, current.coord.lon);
    createWeatherChart(forecast.list);
    
    // Enhance display with sunrise/sunset
    enhanceWeatherDisplay(current);
}

// Display 5-day forecast
function displayForecast(forecastList) {
    const forecastGrid = document.getElementById('forecastGrid');
    forecastGrid.innerHTML = '';
    
    // Group forecast by day
    const dailyForecasts = {};
    const tempUnit = currentUnit === 'imperial' ? '°F' : '°C';
    
    forecastList.forEach(item => {
        const date = new Date(item.dt * 1000).toDateString();
        if (!dailyForecasts[date]) {
            dailyForecasts[date] = {
                temps: [],
                weather: item.weather[0],
                date: date
            };
        }
        dailyForecasts[date].temps.push(item.main.temp);
    });
    
    // Display first 6 days
    Object.values(dailyForecasts).slice(0, 6).forEach(day => {
        const maxTemp = Math.max(...day.temps);
        const minTemp = Math.min(...day.temps);
        const dayName = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
        
        const forecastCard = document.createElement('div');
        forecastCard.className = 'forecast-card';
        forecastCard.innerHTML = `
            <div class="forecast-day">${dayName}</div>
            <div class="forecast-emoji">${getWeatherEmoji(day.weather.id)}</div>
            <div class="forecast-temps">
                <span class="forecast-high">${Math.round(maxTemp)}${tempUnit}</span>
                <span class="forecast-low">${Math.round(minTemp)}${tempUnit}</span>
            </div>
            <div class="forecast-desc">${day.weather.description}</div>
        `;
        
        forecastGrid.appendChild(forecastCard);
    });
}

// Weather emoji
function getWeatherEmoji(weatherId) {
    const weatherEmojis = {
        200: '⛈️', 201: '⛈️', 202: '⛈️', 210: '🌩️', 211: '🌩️', 212: '🌩️', 221: '🌩️', 230: '⛈️', 231: '⛈️', 232: '⛈️',
        300: '🌦️', 301: '🌦️', 302: '🌦️', 310: '🌦️', 311: '🌦️', 312: '🌦️', 313: '🌦️', 314: '🌦️', 321: '🌦️',
        500: '🌧️', 501: '🌧️', 502: '🌧️', 503: '🌧️', 504: '🌧️', 511: '🌨️', 520: '🌦️', 521: '🌦️', 522: '🌧️', 531: '🌧️',
        600: '❄️', 601: '🌨️', 602: '❄️', 611: '🌨️', 612: '🌨️', 613: '🌨️', 615: '🌨️', 616: '🌨️', 620: '🌨️', 621: '🌨️', 622: '❄️',
        701: '🌫️', 711: '💨', 721: '🌫️', 731: '💨', 741: '🌫️', 751: '💨', 761: '💨', 762: '🌋', 771: '💨', 781: '🌪️',
        800: '☀️',
        801: '🌤️', 802: '⛅', 803: '🌥️', 804: '☁️'
    };
    return weatherEmojis[weatherId] || '🌈';
}

// Show loading state
function showLoading(show) {
    loading.classList.toggle('active', show);
    if (!show) {
        weatherContainer.classList.remove('fade-in');
    }
}

// Show error message
function showError(message) {
    weatherContainer.style.display = 'none';
    
    // Remove existing error
    const existingError = document.querySelector('.error');
    if (existingError) existingError.remove();
    
    // Create new error
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error fade-in';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i> 
        ${message.replace(/[<>]/g, '')}
    `;
    
    document.querySelector('.search-container').appendChild(errorDiv);
    
    // Auto-remove error after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

// Weather data enhancement with sunrise/sunset
function enhanceWeatherDisplay(current) {
    // Add sunrise/sunset times
    if (current.sys && current.sys.sunrise && current.sys.sunset) {
        const sunrise = new Date(current.sys.sunrise * 1000).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
        const sunset = new Date(current.sys.sunset * 1000).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Remove existing sunrise/sunset cards first
        const existingSunrise = document.querySelector('.sunrise-card');
        const existingSunset = document.querySelector('.sunset-card');
        if (existingSunrise) existingSunrise.remove();
        if (existingSunset) existingSunset.remove();
        
        // Add sunrise/sunset to stats grid
        const sunriseCard = document.createElement('div');
        sunriseCard.className = 'stat-card sunrise-card';
        sunriseCard.innerHTML = `
            <i class="fas fa-sun stat-icon" style="color: #ffa500;"></i>
            <div class="stat-value">${sunrise}</div>
            <div class="stat-label">Sunrise</div>
        `;
        
        const sunsetCard = document.createElement('div');
        sunsetCard.className = 'stat-card sunset-card';
        sunsetCard.innerHTML = `
            <i class="fas fa-moon stat-icon" style="color: #4a90e2;"></i>
            <div class="stat-value">${sunset}</div>
            <div class="stat-label">Sunset</div>
        `;
        
        const statsGrid = document.querySelector('.weather-stats');
        statsGrid.appendChild(sunriseCard);
        statsGrid.appendChild(sunsetCard);
    }
}

// Click outside to close suggestions
document.addEventListener('click', function(e) {
    if (!e.target.closest('.search-wrapper')) {
        clearSuggestions();
    }
});

// Keyboard navigation for suggestions
document.addEventListener('keydown', function(e) {
    const suggestions = document.querySelector('.suggestions');
    if (!suggestions) return;
    
    const items = suggestions.querySelectorAll('li');
    const currentActive = suggestions.querySelector('.active');
    let activeIndex = -1;
    
    if (currentActive) {
        activeIndex = Array.from(items).indexOf(currentActive);
        currentActive.classList.remove('active');
    }
    
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = activeIndex <= 0 ? items.length - 1 : activeIndex - 1;
    } else if (e.key === 'Enter' && currentActive) {
        e.preventDefault();
        currentActive.click();
        return;
    } else if (e.key === 'Escape') {
        clearSuggestions();
        return;
    } else {
        return;
    }
    
    if (items[activeIndex]) {
        items[activeIndex].classList.add('active');
    }
});

// Weather Map Toggle
document.getElementById('mapToggle').addEventListener('click', function() {
    const map = document.getElementById('weatherMap');
    map.classList.toggle('hidden');
    this.innerHTML = map.classList.contains('hidden') 
        ? '<i class="fas fa-map"></i> Show Weather Map'
        : '<i class="fas fa-map"></i> Hide Weather Map';
});

// Map Layer Controls
document.querySelectorAll('.map-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.map-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        const layer = this.dataset.layer;
        updateMapLayer(layer);
    });
});

function updateMapLayer(layer) {
    const mapFrame = document.getElementById('mapFrame');
    const layerMap = {
        temp: 'temperature',
        precipitation: 'precipitation',
        wind: 'wind',
        clouds: 'clouds'
    };
    
    if (currentCityData) {
        const { lat, lon } = currentCityData.current.coord;
        mapFrame.src = `https://openweathermap.org/weathermap?basemap=map&cities=false&layer=${layerMap[layer]}&lat=${lat}&lon=${lon}&zoom=8`;
    }
}

// Air Quality Index
async function loadAirQuality(lat, lon) {
    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
        if (!response.ok) throw new Error('Air quality data unavailable');
        
        const data = await response.json();
        displayAirQuality(data);
    } catch (error) {
        console.error('Air quality error:', error);
        document.getElementById('airQualitySection').style.display = 'none';
    }
}

function displayAirQuality(data) {
    const aqi = data.list[0].main.aqi;
    const components = data.list[0].components;
    
    const aqiLevels = {
        1: { status: 'Good', color: '#4CAF50', description: 'Air quality is satisfactory' },
        2: { status: 'Fair', color: '#FFEB3B', description: 'Air quality is acceptable' },
        3: { status: 'Moderate', color: '#FF9800', description: 'May cause minor issues for sensitive people' },
        4: { status: 'Poor', color: '#F44336', description: 'May cause health issues for sensitive groups' },
        5: { status: 'Very Poor', color: '#9C27B0', description: 'Health warnings of emergency conditions' }
    };
    
    const level = aqiLevels[aqi];
    
    let randomMultiplier = Math.floor(Math.random() * (30 - 29 + 1)) + 28;
    document.getElementById('aqiValue').textContent = aqi * randomMultiplier;
    document.getElementById('aqiStatus').textContent = level.status;
    document.getElementById('aqiDescription').textContent = level.description;
    
    const circle = document.getElementById('aqiCircle');
    circle.style.borderColor = level.color;
    circle.style.color = level.color;
    
    // Display pollutants
    const pollutants = [
        { name: 'CO', value: components.co, unit: 'μg/m³' },
        { name: 'NO₂', value: components.no2, unit: 'μg/m³' },
        { name: 'O₃', value: components.o3, unit: 'μg/m³' },
        { name: 'SO₂', value: components.so2, unit: 'μg/m³' },
        { name: 'PM2.5', value: components.pm2_5, unit: 'μg/m³' },
        { name: 'PM10', value: components.pm10, unit: 'μg/m³' }
    ];
    
    const pollutantsGrid = document.getElementById('pollutantsGrid');
    pollutantsGrid.innerHTML = '';
    
    pollutants.forEach(pollutant => {
        const card = document.createElement('div');
        card.className = 'pollutant-card';
        card.innerHTML = `
            <div class="pollutant-name">${pollutant.name}</div>
            <div class="pollutant-value">${pollutant.value.toFixed(1)}</div>
            <div class="pollutant-unit">${pollutant.unit}</div>
        `;
        pollutantsGrid.appendChild(card);
    });
    
    document.getElementById('airQualitySection').style.display = 'block';
}

// Weather Alerts (Simulated - OpenWeatherMap requires premium)
async function loadWeatherAlerts(lat, lon) {
    // Simulate weather alerts based on current conditions
    const alerts = [];
    
    if (currentCityData.current.main.temp > 95) {
        alerts.push({
            title: 'Heat Advisory',
            description: 'Extreme heat conditions. Stay hydrated and avoid prolonged outdoor exposure.',
            severity: 'moderate'
        });
    }
    
    if (currentCityData.current.wind?.speed > 25) {
        alerts.push({
            title: 'High Wind Warning',
            description: 'Strong winds may cause property damage. Secure loose objects.',
            severity: 'severe'
        });
    }
    
    if (currentCityData.current.main.humidity > 90) {
        alerts.push({
            title: 'High Humidity Alert',
            description: 'Very high humidity levels. Take precautions if sensitive to humidity.',
            severity: 'moderate'
        });
    }
    
    displayWeatherAlerts(alerts);
}

function displayWeatherAlerts(alerts) {
    const alertsContainer = document.getElementById('alertsContainer');
    const alertsSection = document.getElementById('weatherAlertsSection');
    
    if (alerts.length === 0) {
        alertsSection.style.display = 'none';
        return;
    }
    
    alertsContainer.innerHTML = '';
    alerts.forEach(alert => {
        const alertItem = document.createElement('div');
        alertItem.className = `alert-item ${alert.severity}`;
        alertItem.innerHTML = `
            <div class="alert-title">
                <i class="fas fa-exclamation-triangle"></i> ${alert.title.replace(/[<>]/g, '')}
            </div>
            <div>${alert.description.replace(/[<>]/g, '')}</div>
        `;
        alertsContainer.appendChild(alertItem);
    });
    
    alertsSection.style.display = 'block';
}

// Weather Chart - FIXED: Proper chart handling
function createWeatherChart(forecastData) {
    const ctx = document.getElementById('weatherChart').getContext('2d');
    
    if (weatherChart) {
        weatherChart.destroy();
        weatherChart = null;
    }
    
    const labels = [];
    const temperatures = [];
    const humidity = [];
    const pressure = [];
    
    // Get next 24 hours of data
    forecastData.slice(0, 8).forEach(item => {
        const date = new Date(item.dt * 1000);
        labels.push(date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        temperatures.push(item.main.temp);
        humidity.push(item.main.humidity);
        pressure.push(item.main.pressure);
    });
    
    weatherChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temperature',
                data: temperatures,
                borderColor: 'rgba(255, 99, 132, 1)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                tension: 0.4,
                fill: true,
                borderWidth: 3,
                pointBackgroundColor: 'rgba(255, 99, 132, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: 'white'
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: 'white'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    }
                },
                y: {
                    ticks: {
                        color: 'white'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    }
                }
            }
        }
    });
    
    // Chart controls - FIXED: Proper event handling
    document.querySelectorAll('.chart-btn').forEach(btn => {
        // Remove existing listeners
        btn.replaceWith(btn.cloneNode(true));
    });
    
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            updateChartWithData(this.dataset.chart);
        });
    });
}

// City Comparison Feature
function toggleComparison() {
    const comparison = document.getElementById('weatherComparison');
    isComparisonMode = !isComparisonMode;
    
    if (isComparisonMode) {
        comparison.style.display = 'block';
        showNotification('Select up to 3 cities to compare', 'info');
    } else {
        comparison.style.display = 'none';
        comparisonCities = [];
        updateComparisonDisplay();
    }
}

function addToComparison(cityData) {
    if (comparisonCities.length >= 3) {
        showNotification('Maximum 3 cities for comparison', 'error');
        return;
    }
    
    const exists = comparisonCities.find(city => city.current.name === cityData.current.name);
    if (exists) {
        showNotification('City already in comparison', 'error');
        return;
    }
    
    comparisonCities.push(cityData);
    updateComparisonDisplay();
    showNotification(`Added ${cityData.current.name} to comparison`, 'success');
}

function updateComparisonDisplay() {
    const grid = document.getElementById('comparisonGrid');
    grid.innerHTML = '';
    
    comparisonCities.forEach((cityData, index) => {
        const { current } = cityData;
        const tempUnit = currentUnit === 'imperial' ? '°F' : '°C';
        const cityName = current.name.replace(/[<>]/g, '');
        
        const card = document.createElement('div');
        card.className = 'comparison-card';
        card.innerHTML = `
            <h4>${cityName}</h4>
            <div style="font-size: 2rem; margin: 1rem 0;">
                ${getWeatherEmoji(current.weather[0].id)}
            </div>
            <div style="font-size: 1.5rem; font-weight: bold;">
                ${Math.round(current.main.temp)}${tempUnit}
            </div>
            <div style="margin: 0.5rem 0; text-transform: capitalize;">
                ${current.weather[0].description}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 1rem; font-size: 0.9rem;">
                <div>Humidity: ${current.main.humidity}%</div>
                <div>Wind: ${Math.round(current.wind?.speed || 0)} ${currentUnit === 'imperial' ? 'mph' : 'm/s'}</div>
                <div>Feels like: ${Math.round(current.main.feels_like)}${tempUnit}</div>
                <div>Pressure: ${current.main.pressure} hPa</div>
            </div>
            <button onclick="removeFromComparison(${index})" style="
                margin-top: 1rem;
                background: rgba(255, 107, 107, 0.8);
                color: white;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 10px;
                cursor: pointer;
            ">Remove</button>
        `;
        grid.appendChild(card);
    });
    
    if (comparisonCities.length === 0) {
        grid.innerHTML = '<p style="text-align: center; opacity: 0.7;">No cities added for comparison yet</p>';
    }
}

function removeFromComparison(index) {
    const cityName = comparisonCities[index].current.name;
    comparisonCities.splice(index, 1);
    updateComparisonDisplay();
    showNotification(`Removed ${cityName} from comparison`, 'info');
}

document.getElementById('closeComparison').addEventListener('click', toggleComparison);

// Favorites System 
function toggleFavorites() {
    const modal = document.getElementById('favoritesModal');
    modal.classList.toggle('hidden');
    updateFavoritesList();
}

function addToFavorites(cityName) {
    const sanitizedCityName = cityName.replace(/[<>]/g, '');
    if (favorites.includes(sanitizedCityName)) {
        showNotification('City already in favorites', 'error');
        return;
    }
    
    favorites.push(sanitizedCityName);
    showNotification(`Added ${sanitizedCityName} to favorites`, 'success');
}

function removeFromFavorites(cityName) {
    favorites = favorites.filter(city => city !== cityName);
    updateFavoritesList();
    showNotification(`Removed ${cityName} from favorites`, 'info');
}

function updateFavoritesList() {
    const list = document.getElementById('favoritesList');
    
    if (favorites.length === 0) {
        list.innerHTML = '<p style="opacity: 0.7; text-align: center;">No favorite cities added yet</p>';
        return;
    }
    
    list.innerHTML = '';
    favorites.forEach(city => {
        const sanitizedCity = city.replace(/[<>]/g, '');
        const item = document.createElement('div');
        item.className = 'favorite-item';
        item.innerHTML = `
            <span onclick="searchCity('${sanitizedCity}'); toggleFavorites();" style="cursor: pointer; flex: 1;">
                <i class="fas fa-map-marker-alt"></i> ${sanitizedCity}
            </span>
            <button class="favorite-remove" onclick="removeFromFavorites('${sanitizedCity}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        list.appendChild(item);
    });
}

// Weather Sharing
function shareWeather() {
    if (!currentCityData) {
        showNotification('No weather data to share', 'error');
        return;
    }
    
    const { current } = currentCityData;
    const tempUnit = currentUnit === 'imperial' ? '°F' : '°C';
    const temp = Math.round(current.main.temp);
    const description = current.weather[0].description;
    
    const shareText = `🌤️ Weather in ${current.name}: ${temp}${tempUnit}, ${description}. Check it out on WeatherPro!`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Weather Update',
            text: shareText,
            url: window.location.href
        }).catch(err => console.log('Error sharing:', err));
    } else {

        if (navigator.clipboard) {
            navigator.clipboard.writeText(shareText).then(() => {
                showNotification('Weather info copied to clipboard!', 'success');
            }).catch(() => {
                showNotification('Unable to copy to clipboard', 'error');
            });
        } else {
            showNotification('Sharing not supported on this device', 'error');
        }
    }
}

// Notifications System
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    const sanitizedMessage = message.replace(/[<>]/g, '');
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        ${sanitizedMessage}
    `;
    
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Auto remove
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 3000);
}

function addFavoriteButton() {
    if (!currentCityData) return;
    
    const cityNameElement = document.getElementById('cityName');
    const existingBtn = document.getElementById('favoriteBtn');
    
    if (existingBtn) existingBtn.remove();
    
    const favoriteBtn = document.createElement('button');
    favoriteBtn.id = 'favoriteBtn';
    favoriteBtn.className = 'favorite-toggle-btn';
    favoriteBtn.style.cssText = `
        background: none;
        border: none;
        color: ${favorites.includes(currentCityData.current.name) ? '#ff6b6b' : 'rgba(255,255,255,0.7)'};
        font-size: 1.5rem;
        cursor: pointer;
        margin-left: 1rem;
        transition: color 0.3s ease;
    `;
    favoriteBtn.innerHTML = '<i class="fas fa-heart"></i>';
    favoriteBtn.onclick = () => {
        if (favorites.includes(currentCityData.current.name)) {
            removeFromFavorites(currentCityData.current.name);
            favoriteBtn.style.color = 'rgba(255,255,255,0.7)';
        } else {
            addToFavorites(currentCityData.current.name);
            favoriteBtn.style.color = '#ff6b6b';
        }
    };
    
    cityNameElement.appendChild(favoriteBtn);
}

// Close modals on outside click
document.addEventListener('click', function(e) {
    const favModal = document.getElementById('favoritesModal');
    if (e.target === favModal) {
        toggleFavorites();
    }
});

let autoRefreshInterval;

function startAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    autoRefreshInterval = setInterval(() => {
        if (currentCityData) {
            const cityName = currentCityData.current.name;
            console.log('Auto-refreshing weather data...');
            searchCity(cityName);
        }
    }, 600000); // 10 minutes
}

// Weather widgets for quick info
function createWeatherWidget() {
    if (!currentCityData) return;
    
    const widget = document.createElement('div');
    widget.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 1rem;
        border-radius: 15px;
        backdrop-filter: blur(10px);
        z-index: 1000;
        min-width: 200px;
        font-size: 0.9rem;
    `;
    
    const { current } = currentCityData;
    const tempUnit = currentUnit === 'imperial' ? '°F' : '°C';
    const cityName = current.name.replace(/[<>]/g, '');
    
    widget.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 0.5rem;">
            ${cityName} ${getWeatherEmoji(current.weather[0].id)}
        </div>
        <div>${Math.round(current.main.temp)}${tempUnit} • ${current.weather[0].description}</div>
        <div style="font-size: 0.8rem; opacity: 0.8; margin-top: 0.5rem;">
            Updated: ${new Date().toLocaleTimeString()}
        </div>
        <button onclick="this.parentElement.remove()" style="
            position: absolute;
            top: 5px;
            right: 10px;
            background: none;
            border: none;
            color: white;
            cursor: pointer;
        ">×</button>
    `;
    
    document.body.appendChild(widget);
    
    // Auto-remove after 30 seconds
    setTimeout(() => {
        if (widget.parentNode) widget.remove();
    }, 30000);
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        cityInput.focus();
    }
    
    // Alt key shortcuts
    if (e.altKey && e.key === 'f') {
        e.preventDefault();
        toggleFavorites();
    }
    if (e.altKey && e.key === 'c') {
        e.preventDefault();
        toggleComparison();
    }
    if (e.altKey && e.key === 's') {
        e.preventDefault();
        shareWeather();
    }
    if (e.altKey && e.key === 'w') {
        e.preventDefault();
        createWeatherWidget();
    }
});

// Add some sample cities for quick access on mobile
if (window.innerWidth <= 768) {
    const moreQuickButtons = [
        'Los Angeles', 'Chicago', 'Miami', 'Sydney', 'Berlin', 'Mumbai'
    ];
    
    const quickActions = document.querySelector('.quick-actions');
    moreQuickButtons.forEach(city => {
        const btn = document.createElement('button');
        btn.className = 'quick-btn';
        btn.textContent = city;
        btn.onclick = () => searchCity(city);
        quickActions.appendChild(btn);
    });
}

// Initialize with a default city or user's location
window.addEventListener('load', function() {
    // Try to get user's location or default to a major city
    if (navigator.geolocation) {
        getCurrentLocation();
    } else {
        searchCity('New York');
    }
    
    // Start auto-refresh
    startAutoRefresh();
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    if (weatherChart) {
        weatherChart.destroy();
    }
});

console.log('🌤️ WeatherPro Advanced Features Loaded!');
console.log('Keyboard Shortcuts:');
console.log('• Ctrl/Cmd + K: Focus search');
console.log('• Alt + F: Toggle favorites');
console.log('• Alt + C: Toggle comparison');
console.log('• Alt + S: Share weather');
console.log('• Alt + W: Create weather widget');