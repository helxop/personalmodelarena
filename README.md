Of course. Creating good documentation is essential for making a project understandable, usable, and maintainable. Here is a comprehensive documentation for your "LLM Battle Arena & Ranking" application, written in Markdown format.

This documentation is structured to be the perfect `README.md` file for your GitHub repository.

---

# LLM Battle Arena & Ranking

An advanced, browser-based tool for evaluating and ranking Large Language Models (LLMs) through pairwise comparisons. This application allows users to load, edit, and analyze battle data using two distinct statistical models: the classic **ELO system** and the holistic **Bradley-Terry model**.

The entire application runs client-side, with all data managed locally in your browser.



## Features

-   **Dual Ranking Systems:** Switch on-the-fly between the **Bradley-Terry** model (order-independent, holistic) and the **ELO** system (sequential, order-dependent) to compare different rating methodologies.
-   **Comprehensive Leaderboard:** View a detailed leaderboard with stats for Rating, Wins, Losses, Ties, Total Matches, and Winrate.
-   **Dynamic Sorting:** Sort the leaderboard by any statistical column in both ascending and descending order.
-   **Data Persistence:** Your battle data is automatically saved to your browser's `localStorage`, so you never lose your work when you close the tab.
-   **Full Data Control:**
    -   **Load Data:** Load existing battle data from a local JSON file.
    -   **Edit Data:** Add, delete, or modify battle entries in a clean, card-based interface.
    -   **Export Data:** View, copy, or download your entire dataset as a clean JSON file.
    -   **Clear Data:** Easily clear all data to start a new session.
-   **Smart UI & UX:**
    -   **Autocomplete:** Model name fields provide autocomplete suggestions to ensure data consistency and prevent typos.
    *   **Loading Indicator:** A visual loader appears during intensive calculations, providing clear user feedback.
    *   **"Dirty State" Indicator:** The "Calculate Ratings" button glows when your data has changed, reminding you to re-run the calculations.
-   **Robust Data Handling:**
    *   Handles ties, case-insensitivity, and empty/invalid data entries gracefully.
    *   Supports both a simple `"input": "text"` format and a legacy `{ "type": "text" }` format for backward compatibility.

## How to Use

The application is designed to be intuitive. Here is the standard workflow:

1.  **Load or Create Data:**
    *   Click **"Load File"** to load a `.json` file containing your battle data (see JSON format below).
    *   Or, click **"+ Add Entry"** to start creating battle records from scratch.
2.  **Edit Entries:**
    *   Each battle is a card. You can edit the `Task`, `Model A`, `Model B`, `Input Type`, and `Winner`.
    *   For the `Winner` field, enter the name of the winning model or type `"tie"`.
3.  **Calculate Ratings:**
    *   Choose your preferred ranking system: **Bradley-Terry** or **ELO**.
    *   Click the **"Calculate Ratings"** button. The leaderboard will update with the new rankings. The button will glow if you have unsaved changes.
4.  **Analyze the Leaderboard:**
    *   Click on any column header in the "Leaderboard Controls" (e.g., "Wins", "Winrate") to sort the data. Click again to reverse the order.
5.  **Export Your Data:**
    *   Click **"View / Export"** to open a modal where you can copy your current dataset to the clipboard or download it as a `battle_data.json` file.

## JSON Data Structure

The application uses a simple and clean JSON structure. The root element must be an array of "battle" objects. Each object has the following format:

```json
[
  {
    "task": "A description of the prompt given to the models.",
    "input": "text",
    "match": {
      "model_a": "name-of-model-a",
      "model_b": "name-of-model-b"
    },
    "winner": "name-of-model-a"
  },
  {
    "task": "Another task description.",
    "input": "image",
    "match": {
      "model_a": "name-of-model-c",
      "model_b": "name-of-model-a"
    },
    "winner": "tie"
  }
]
```

### Field Descriptions:

-   `task` (String): The user prompt or task for the battle.
-   `input` (String): The type of input. Must be either `"text"` or `"image"`.
-   `match` (Object): Contains the names of the two competing models.
    -   `model_a` (String): The name of the first model.
    -   `model_b` (String): The name of the second model.
-   `winner` (String): The name of the winning model. This must exactly match either `model_a` or `model_b`. Alternatively, use the string `"tie"` for a draw.

## Ranking System Formulas

The application provides two scientifically-backed ranking methods.

### 1. Bradley-Terry Model (Default)

This model is holistic, meaning it considers all battle results simultaneously to find the set of "strength" parameters that best explains the data. The order of battles does not affect the final rating.

-   **Core Formula:** The probability of model `i` beating model `j` is `P(i > j) = Strength_i / (Strength_i + Strength_j)`.
-   **Implementation:** The application uses an iterative algorithm (Maximum Likelihood Estimation) to solve for the `Strength` parameters for all models.
-   **Rating Conversion:** The raw strength is converted to a familiar scale using:
    `Rating = 1500 + 400 * log10(Strength)`

### 2. ELO System

This is a sequential rating system where rankings are updated after each individual battle. The order of battles is critical to the final result.

-   **Core Formula:** A model's new rating is calculated based on its previous rating, the expected outcome, and the actual outcome.
-   **Update Rule:** `NewRating = OldRating + K * (ActualScore - ExpectedScore)`
    -   `K-Factor`: A constant set to `32`.
    -   `ActualScore`: 1 for a win, 0.5 for a tie, 0 for a loss.
    -   `ExpectedScore`: The win probability calculated from the rating difference between the two models.

## How to Run Locally

This is a pure HTML, CSS, and JavaScript application with no server-side dependencies.

1.  Create a project folder.
2.  Save the three provided files (`index.html`, `style.css`, `script.js`) inside this folder.
3.  Open the `index.html` file in any modern web browser.
