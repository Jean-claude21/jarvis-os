# Connecting an agent to Jarvis

An agent is a program of yours that runs outside Jarvis (on your server, in a container): it
collects, reads, computes. Jarvis keeps, checks and shows what it sends. Spec: `specs/050-agents`.

## 1. Give the agent a key

**Compte → Clés personnelles → Créer une clé.** Name it after the agent, choose **one space**, and
tick **the kinds it may write** (« Offre », « Entreprise »). The key (`jos_…`) is shown once.

The agent sends it as `Authorization: Bearer jos_…`. With it, the agent:

- sees and writes only that space (another space: `403`);
- writes only the ticked kinds (any other: `403`, nothing written);
- never makes keys, connections or spaces;
- appears in your journal as `key:<its name>`: every line it wrote can be undone.

## 2. The agent sends what it found

```http
POST /api/receive
Authorization: Bearer jos_…
Content-Type: application/json

{
  "kind": "Offre",
  "match": "url",
  "title": "{poste} — {entreprise}",
  "items": [
    { "job_title": "Stage IA", "company": "Exemple", "job_url": "https://ex.com/1" }
  ]
}
```

Answer: `{ "created": 1, "updated": 0, "skipped": 0, "ids": [...], "setAside": [] }`.

- **The contract is your model.** Each item is checked by the model of `kind` (types, required
  fields, unique values), as anything you write.
- **Your model translates.** On the model page (Modèles de type), a field's **Autres noms**
  (`job_title, position`) are the names an agent may send it under. No code on either side.
- **`match`**: an entry with the same value of that field is updated, never doubled.
- **`setAside`**: what the agent sent that your model has no field for (kept nowhere).
- At most 200 items per call.

## 3. Or Jarvis calls the agent

1. **Connexions → Ajouter → Avec une clé ou un en-tête → Type : Adresse HTTP (un agent).** Its
   address (`https://agent.example.com`) and its key, sealed by Jarvis: they never appear in a rule.
2. A rule (with Claude, or as an entry « Rule »):

```json
{
  "when": { "schedule": "0 7 * * *" },
  "then": [
    {
      "call": {
        "connection": "Agent emplois",
        "path": "/search",
        "body": { "pays": "France" },
        "include": "Profil de recherche",
        "save": {
          "kind": "Offre",
          "at": "offers",
          "match": "url",
          "title": "{poste} — {entreprise}"
        }
      }
    }
  ]
}
```

At 7:00, Jarvis POSTs `body` to `https://agent.example.com/search`, with your entries of
« Profil de recherche » under `entries` (your criteria). The agent answers JSON; the list at
`offers` comes in as in §2. An MCP connection is called the same way with `tool` instead of `path`.

- Only `https` addresses outside private networks (a developer's Jarvis may also call
  `http://localhost`); 20 seconds and 2 MB at most.
- A failure leaves a reminder with the reason; nothing of that answer is written.

## 4. What your app watches for

An app's role can list patterns: `{ "about": "Candidatures envoyées", "kind": "Candidature",
"where": "statut = 'envoyée'" }` (add `"sum": "amount"` to add up a field, `"rise": 40` to change
the threshold of 30 %). The last 30 days against the 30 before; when it moved enough, it comes back
in your Revue (« Ce qui revient »), named with the app.
