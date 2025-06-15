Of course. With the major addition of category filtering, the documentation needs a significant update to explain the new, powerful features.

Here is a comprehensive `README.md` for the latest version of your "LLM Battle Arena & Ranking" application.

---

# LLM Battle Arena & Ranking

An advanced, browser-based tool for evaluating and ranking Large Language Models (LLMs) through pairwise comparisons. This application allows users to load, edit, and analyze battle data using two distinct statistical models: the classic **ELO system** and the holistic **Bradley-Terry model**.

A key feature of this tool is the ability to **filter battles by category**, allowing for specialized leaderboards that reveal model strengths and weaknesses in specific domains like `summarization`, `html_dev`, or `creative_writing`.

The entire application runs client-side, with all data managed locally in your browser.

## Features

-   **Category-Specific Rankings:**
    -   A **"Filter by Category"** dropdown is automatically populated from your data.
    -   Select a category to instantly filter the battle list and calculate a dedicated leaderboard, showing which models excel in specific tasks.
-   **Dual Ranking Systems:**
    -   Switch on-the-fly between the **Bradley-Terry** model (order-independent, holistic) and the **ELO** system (sequential, order-dependent) to compare different rating methodologies.
-   **Comprehensive Leaderboard:**
    -   View detailed stats for Rating, Wins, Losses, Ties, Total Matches, and Winrate for either the full dataset or a filtered category.
    -   Sort the leaderboard by any column in both ascending and descending order.
-   **Full Data Control:**
    -   **Load & Export:** Load battle data from a local JSON file and export your work at any time.
    -   **Edit Data:** A clean, card-based interface for adding, deleting, or modifying battle entries.
    -   **Clear Session:** A "Clear All" button to easily start fresh.
-   **Data Persistence:**
    -   Your entire battle list is automatically saved to your browser's `localStorage`, so your session is preserved even if you close the tab.
-   **Smart UI & UX:**
    -   **Autocomplete:** Model name fields provide suggestions to ensure data consistency.
    *   **Loading Indicator:** A visual loader provides feedback during intensive calculations.
    *   **"Dirty State" Indicator:** The "Calculate Ratings" button glows to indicate that the displayed leaderboard is out of sync with your latest data changes.

## How to Use

The application is designed to be intuitive. Here is the standard workflow:

1.  **Load or Create Data:**
    *   Click **"Load File"** to load a `.json` file containing your battle data (see JSON format below).
    *   Or, click **"+ Add Entry"** to start creating battle records from scratch.
2.  **Filter by Category (Optional):**
    *   Use the **"Filter by Category"** dropdown in the header to focus on a specific task type. The leaderboard and editor will instantly update to show only the relevant battles.
    *   Select "All Categories" to see the full dataset.
3.  **Calculate Ratings:**
    *   Choose your preferred ranking system: **Bradley-Terry** or **ELO**.
    *   Click the **"Calculate Ratings"** button. The leaderboard will update based on the currently filtered data.
4.  **Analyze and Sort:**
    *   Click on any column header in the "Leaderboard Controls" (e.g., "Wins", "Winrate") to sort the data. Click again to reverse the order.
5.  **Export Your Data:**
    *   Click **"View / Export"** to open a modal where you can copy your current dataset to the clipboard or download it as a `battle_data.json` file.

## JSON Data Structure

The application now supports a `category` field for each battle. The root element must be an array of "battle" objects.

```json
[
  {
    "task": "Summarize the following text with 5 bullet points in Turkish",
    "input": "text",
    "category": "summarization",
    "match": {
      "model_a": "o3-2025-04-16",
      "model_b": "claude-opus-4-20250514"
    },
    "winner": "claude-opus-4-20250514"
  },
  {
    "task": "Create a cat selling lemonade with SVG",
    "input": "text",
    "category": "svg_dev",
    "match": {
      "model_a": "qwen3-235b-a22b-no-thinking",
      "model_b": "claude-opus-4-20250514"
    },
    "winner": "tie"
  }
]
```

### Field Descriptions:

-   `task` (String): The user prompt or task for the battle.
-   `input` (String): The type of input. Either `"text"` or `"image"`.
-   **`category` (String, Optional):** The category of the task. This is used for filtering.
-   `match` (Object): Contains the names of the two competing models.
    -   `model_a` (String): The name of the first model.
    -   `model_b` (String): The name of the second model.
-   `winner` (String): The name of the winning model. This must match either `model_a` or `model_b`. Alternatively, use the string `"tie"` for a draw.

## Ranking System Formulas

The application provides two scientifically-backed ranking methods.

### 1. Bradley-Terry Model (Default)

This model is holistic, meaning it considers all battle results (within the current filter) simultaneously to find the set of "strength" parameters that best explains the data. The order of battles does not affect the final rating.

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