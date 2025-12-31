export class SearchPersistence {
  static KEY_PREFIX = "maia_search_";

  static startSession(slug) {
    if (!slug) return;
    try {
      sessionStorage.setItem(this.KEY_PREFIX + "active_slug", slug);
      sessionStorage.setItem(this.KEY_PREFIX + "status", "running");
      sessionStorage.setItem(this.KEY_PREFIX + "start_time", Date.now());
    } catch (e) {
      console.warn("SearchPersistence: Error starting session", e);
    }
  }

  static saveTasks(tasks) {
    try {
      sessionStorage.setItem(this.KEY_PREFIX + "tasks", JSON.stringify(tasks));
    } catch (e) {
      // ignore quota exceeded etc
    }
  }

  static finishSession(isSuccess = true) {
    try {
      sessionStorage.setItem(
        this.KEY_PREFIX + "status",
        isSuccess ? "completed" : "failed"
      );
    } catch (e) {
      console.warn("SearchPersistence: Error finishing session", e);
    }
  }

  static getSession() {
    try {
      return {
        slug: sessionStorage.getItem(this.KEY_PREFIX + "active_slug"),
        status: sessionStorage.getItem(this.KEY_PREFIX + "status"),
        tasks: JSON.parse(
          sessionStorage.getItem(this.KEY_PREFIX + "tasks") || "[]"
        ),
      };
    } catch (e) {
      return null;
    }
  }

  static clear() {
    sessionStorage.removeItem(this.KEY_PREFIX + "active_slug");
    sessionStorage.removeItem(this.KEY_PREFIX + "status");
    sessionStorage.removeItem(this.KEY_PREFIX + "tasks");
    sessionStorage.removeItem(this.KEY_PREFIX + "start_time");
  }
}
