const https = require("https"); // or 'https' for https:// URLs
const fs = require("fs");
const electron = require("electron");
const axios = require("axios");

window.addEventListener("DOMContentLoaded", () => {
  main();
});

const download = (url, dest, onSetMessage) => {
  return new Promise((resolve, reject) => {
    try {
      var file = fs.createWriteStream(dest);

      var request = https
        .get(url, function (response) {
          response.pipe(file);
          file.on("finish", function () {
            onSetMessage(`Download success: ${dest}`);
            file.close(); // close() is async, call cb after close completes.
            console.log("download success");
            resolve(dest);
          });
        })
        .on("error", function (err) {
          if (dest) {
            fs.unlink(dest, (error => {
              if (error) {
                onSetMessage(`Download err: ${error}`);
                reject(err);
              } else {
                console.log(`\nDeleted file: ${dest}`);
              }
            }));
          }
          onSetMessage(`Download err: ${err}`);
          reject(err);
        });
    } catch (err) {
      reject(err);
    }
  });
};
//call recursive when get enough videos
const getVideoUrls = async (
  tiktokName,
  count = 10,
  user_id = null,
  cursor = 0
) => {
  const MAX_COUNT = 35;
  const countOption = count > MAX_COUNT ? MAX_COUNT : count;
  const options = {
    method: "GET",
    url: "https://tiktok-video-no-watermark2.p.rapidapi.com/user/posts",
    params: {
      unique_id: tiktokName,
      user_id,
      count: countOption,
      cursor,
    },
    headers: {
      "X-RapidAPI-Key": "42eb3f0813mshc5ea0c653e9e43ep14ca0cjsn73cadb0dc230",
      "X-RapidAPI-Host": "tiktok-video-no-watermark2.p.rapidapi.com",
    },
  };
  const resp = await axios.request(options);
  // console.log(resp.data.data.videos);
  const data = resp.data.data;
  const videos = data.videos;
  const urls = videos.map((item) => item.play);

  console.log("in func: ", urls.length);
  //call recursive when get enough videos
  if (urls.length < count) {
    console.log("Not enough videos, call recursive");
    const nextCursor = data.cursor;
    const nextUserId = data.videos[0].author.id;
    const haveMore = data.hasMore;
    if (haveMore) {
      const nextUrls = await getVideoUrls(
        tiktokName,
        count - urls.length,
        nextUserId,
        nextCursor
      );
      return [...urls, ...nextUrls];
    }
    console.log("No more videos");
    return urls.slice(0, count); //if exceed max count
  }
  return urls.slice(0, count); //if exceed max count
};

const handleDownload = async (
  unique_id,
  count,
  onSetMessage,
  regionValue,
  keywordsValue
) => {
  try {
    let progress = 0;
    //chose where to save files
    const invokeResult = await electron.ipcRenderer.invoke(
      "showDialog",
      "message"
    );
    if (invokeResult.canceled) {
      alert("You must select a folder to save the files");
      return;
    }
    const folder = invokeResult.filePaths[0];
    onSetMessage(`Getting video urls...`);
    let urls;
    if (regionValue && count && keywordsValue) {
      urls = await getVideoUrls2(unique_id, count, regionValue, keywordsValue);
    } else {
      urls = await getVideoUrls(unique_id, count);
    }
    const uniqueUrls = [...new Set(urls)];
    onSetMessage(`Downloading ${uniqueUrls.length} videos...`);

    const res = await Promise.all(
      uniqueUrls.map(async (url, index) => {
        const res = await download(
          url,
          `${folder}/${unique_id}-${index}.mp4`,
          onSetMessage
        );
        return res;
      })
    );
    onSetMessage(`Download success`);
  } catch (err) {
    console.log(`Download err: ${err}`);
    alert(`Download err ${err.message}`);
  }
};

async function main() {
  const uniqueIdInput = document.getElementById("unique_id");
  const countEl = document.getElementById("count");

  const button = document.getElementById("download-btn");
  const downloadMsg = document.getElementById("download-msg");
  const inputRegion = document.getElementById("input-region");
  const keywords = document.getElementById("keywords");
  const validateKey = document.getElementById("validateKey");
  const inputKey = document.getElementById("inputKey");
  const formKey = document.getElementById("formKey");
  const formDownload = document.getElementById("formDownload");
  const mainPage = document.getElementById("mainPage");
  const nodeLoad = document.createElement("div");
  nodeLoad.classList.add("loader");
  mainPage.appendChild(nodeLoad);
  const { machineIdSync } = require("node-machine-id");
  const id = machineIdSync();
  const checkdeviceID = await checkDevice(id);
  const handleSetMessage = (msg) => {
    downloadMsg.innerHTML += `<p>${msg}</p>`;

    downloadMsg.scrollTop = downloadMsg.scrollHeight + 100;
  };
  if (checkdeviceID === "OK") {
    formDownload.style.display = "block";
    nodeLoad.remove();
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Downloading...";
      downloadMsg.innerHTML = "";
      const uniqueId = uniqueIdInput.value;
      if (isNaN(countEl.value)) {
        alert("Please enter a valid number");
        return;
      }
      if (countEl.value < 1) {
        alert("Please enter a number greater than 0");
        return;
      }
      await handleDownload(
        uniqueId,
        countEl.value,
        handleSetMessage,
        inputRegion.value,
        keywords.value
      );
      button.disabled = false;
      alert("download success");
      button.textContent = "Download";
    });
  } else {
    formKey.style.display = "block";
    nodeLoad.remove();
    validateKey.addEventListener("click", async () => {
      const checkKey = await checkKeyForm(inputKey.value, id);
      if (checkKey === "OK") {
        formDownload.style.display = "block";
        formKey.style.display = "none";
      }
    });
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Downloading...";
      downloadMsg.innerHTML = "";
      const uniqueId = uniqueIdInput.value;
      if (isNaN(countEl.value)) {
        alert("Please enter a valid number");
        return;
      }
      if (countEl.value < 1) {
        alert("Please enter a number greater than 0");
        return;
      }
      await handleDownload(
        uniqueId,
        countEl.value,
        handleSetMessage,
        inputRegion.value,
        keywords.value
      );
      button.disabled = false;
      alert("download success");
      button.textContent = "Download";
    });
  }
}

const checkKeyForm = (value, id) => {
  return new Promise((resolve, reject) => {
    try {
      var request = https
        .get(
          `https://us-central1-litewallet.cloudfunctions.net/veryfi-key-tiktook-app?key=${value}&deviceId=${id}`,
          function (response) {
            if (response.statusCode === 200) {
              resolve("OK");
            }
          }
        )
        .on("error", function (err) {
          // Handle errors
          onSetMessage(`Key err: ${err}`);
          reject(err);
        });
      return request;
    } catch (err) {
      reject(err);
    }
  });
};

const getVideoUrls2 = async (
  keywords,
  count = 10,
  regionValue,
  keywordValue,
  cursor = 0
) => {
  const MAX_COUNT = 35;
  const countOption = count > MAX_COUNT ? MAX_COUNT : count;
  const options2 = {
    method: "GET",
    url: "https://tiktok-video-no-watermark2.p.rapidapi.com/feed/search",

    params: {
      keywords: keywordValue,
      count: countOption,
      cursor,
      region: regionValue,
    },
    headers: {
      "X-RapidAPI-Key": "42eb3f0813mshc5ea0c653e9e43ep14ca0cjsn73cadb0dc230",
      "X-RapidAPI-Host": "tiktok-video-no-watermark2.p.rapidapi.com",
    },
  };
  const resp = await axios.request(options2);
  const data = resp.data.data;
  const videos = data.videos;
  const urls = videos.map((item) => item.play);

  console.log("in func: ", urls.length);
  //call recursive when get enough videos
  if (urls.length < count) {
    console.log("Not enough videos, call recursive");
    const nextCursor = data.cursor;
    console.log(data.videos, "data.videos");
    const nextUserId = data.videos[0].author.id;
    const haveMore = data.hasMore;
    if (haveMore) {
      const nextUrls = await getVideoUrls(
        keywords,
        count - urls.length,
        nextUserId
      );
      return [...urls, ...nextUrls];
    }
    console.log("No more videos");
    return urls.slice(0, count); //if exceed max count
  }
  return urls.slice(0, count); //if exceed max count
};

const checkDevice = (id) => {
  return new Promise((resolve, reject) => {
    try {
      var request = https
        .get(
          `https://us-central1-litewallet.cloudfunctions.net/check-veryfied?deviceId=${id}`,
          function (response) {
            if (response.statusCode === 200) {
              console.log("OK");
              resolve("OK");
            } else {
              resolve("500");
            }
          }
        )
        .on("error", function (err) {
          // Handle errors
          resolve("500");
        });
      return request;
    } catch (err) {
      resolve("500");
    }
  });
};