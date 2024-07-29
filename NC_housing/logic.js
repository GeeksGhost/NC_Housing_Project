// Read in JSON
const url = "https://raw.githubusercontent.com/GeeksGhost/NC_Housing_Project/main/housing.json";

// Create the tile layers
let streetmap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});

let satellitemap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> contributors'
});

// Initialize the map with base layers
let map = L.map('map', {
    center: [35.7796, -78.6382],  // Centered on Raleigh
    zoom: 7,  // was using 5 before this. 
    layers: [streetmap]
});

// Base maps object
let baseMaps = {
    "Street Map": streetmap,
    "Satellite Map": satellitemap
};

// Add layer control to the map
L.control.layers(baseMaps).addTo(map);

// Function to determine color based on price
function getColor(price) {
    return price > 500000 ? '#67000d' :
           price > 400000 ? '#FF8C00' :
           price > 300000 ? '#FFFF00' :
           price > 200000 ? '#6B8E23' :
           price > 100000 ? '#228B22' :
                            '#90EE90'; 
}

// Add the legend to the map
var legend = L.control({ position: 'bottomright' });

legend.onAdd = function () {
    var div = L.DomUtil.create('div', 'info legend');
    var grades = [0, 100000, 200000, 300000, 400000, 500000];
    var labels = [];

    // Loop through the colors and assigns to legend 
    for (var i = 0; i < grades.length; i++) {
        div.innerHTML +=
            '<i style="background:' + getColor(grades[i] + 1) + '"></i> ' +
            (grades[i] ? '$' + grades[i].toLocaleString() + ' - $' + (grades[i + 1] ? grades[i + 1].toLocaleString() : '+') + '<br>' : '$' + grades[i].toLocaleString() + '+<br>');
    }

    return div;
};

// Add the legend to the map
legend.addTo(map);

// Variable to keep track of the selected region
let selectedRegionData = null; 

// Fetch and process the JSON data
fetch(url)
    .then(response => response.json())
    .then(data => {
        console.log(data); // Debug

        // Extract years from data for the dropdown
        const years = new Set();
        data.forEach(item => {
            Object.keys(item.dates).forEach(date => {
                years.add(date.split('-')[0]);
            });
        });

        const yearDropdown = document.getElementById('chart-dropdown');
        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.text = year;
            yearDropdown.add(option);
        });

        // Initialize ECharts
        var chart = echarts.init(document.getElementById('chart'));

        // Populate map with markers
        data.forEach(item => {
            if (item.latitude && item.longitude && item.dates) {
                // Find the date with the highest price
                let maxPriceDate = Object.keys(item.dates).reduce((max, date) => 
                    item.dates[date] > item.dates[max] ? date : max, Object.keys(item.dates)[0]
                );
                
                let maxPrice = item.dates[maxPriceDate];

                // Determine marker color based on the highest price
                let color = getColor(maxPrice);
                
                // Create a circle marker with the determined color
                let marker = L.circleMarker([item.latitude, item.longitude], {
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.75,
                    radius: 10
                })
                .bindPopup(`
                    <b>${item.RegionName}</b><br>${item.StateName}<br>
                    Highest Price: $${maxPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}<br>Date: ${maxPriceDate}
                `)
                .on('click', function (e) {
                    selectedRegionData = item; // Set region data
                    updateChart();
                });

                marker.addTo(map);
            }
        });

        window.updateChart = function() {
            if (!selectedRegionData) return;

            const selectedYear = document.getElementById('chart-dropdown').value;
            const chartType = document.getElementById('chart-type').value;
            let chartData = [];

            if (chartType === 'bar') {
                Object.keys(selectedRegionData.dates).forEach(date => {
                    if (date.startsWith(selectedYear)) {
                        chartData.push({
                            date: date,
                            value: selectedRegionData.dates[date]
                        });
                    }
                });

                // Echarts bar chart
                const option = {
                    title: {
                        text: selectedRegionData ? `Median Housing Prices in ${selectedRegionData.RegionName}` : 'Median Housing Prices'
                    },
                    tooltip: {
                        trigger: 'axis',
                        formatter: function(params) {
                            return params[0].name + '<br/>' + params[0].seriesName + ': $' + params[0].value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                        }
                    },
                    xAxis: {
                        type: 'category',
                        data: chartData.map(d => d.date)
                    },
                    yAxis: {
                        type: 'value',
                        axisLabel: {
                            formatter: function (value) {
                                return '$' + value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                            }
                        }
                    },
                    series: [{
                        name: 'Median Price',
                        type: 'bar',
                        data: chartData.map(d => d.value)
                    }]
                };
                // initializing
                chart.setOption(option);

            } else if (chartType === 'line') {
                const yearlyAverages = {};

                Object.keys(selectedRegionData.dates).forEach(date => {
                    const year = date.split('-')[0];
                    if (!yearlyAverages[year]) {
                        yearlyAverages[year] = { total: 0, count: 0 };
                    }
                    yearlyAverages[year].total += selectedRegionData.dates[date];
                    yearlyAverages[year].count += 1;
                });

                chartData = Object.keys(yearlyAverages).map(year => ({
                    year: year,
                    average: yearlyAverages[year].total / yearlyAverages[year].count
                }));

                // Echarts line chart
                const option = {
                    title: {
                        text: selectedRegionData ? `Average Housing Prices Over Time in ${selectedRegionData.RegionName}` : 'Average Housing Prices Over Time'
                    },
                    tooltip: {
                        trigger: 'axis',
                        formatter: function(params) {
                            return params[0].name + '<br/>' + params[0].seriesName + ': $' + params[0].value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                        }
                    },
                    xAxis: {
                        type: 'category',
                        data: chartData.map(d => d.year)
                    },
                    yAxis: {
                        type: 'value',
                        axisLabel: {
                            formatter: function (value) {
                                return '$' + value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                            }
                        }
                    },
                    series: [{
                        name: 'Average Price',
                        type: 'line',
                        data: chartData.map(d => d.average)
                    }]
                };
                // initializing 
                chart.setOption(option);
            }
        };

        // Update the chart when the year dropdown or chart type is changed
        document.getElementById('chart-dropdown').addEventListener('change', updateChart);
        document.getElementById('chart-type').addEventListener('change', updateChart);

        // Initially populate the chart with the first region's data
        if (data.length > 0) {
            selectedRegionData = data[0];
            updateChart();
        }
    })
    .catch(error => {
        console.error('Error fetching JSON:', error);
    });
