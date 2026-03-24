import streamlit as st
import pandas as pd
import folium
from streamlit_folium import st_folium
import psycopg2
import os
import shutil
from dotenv import load_dotenv
from PIL import Image

# Page Config
st.set_page_config(layout="wide", page_title="DIPK Dashboard", page_icon="♻️")

# Load Env
load_dotenv()

# --- HELPER FUNCTIONS ---
from sqlalchemy import create_engine

# ... (Previous imports kept if needed, assuming they are outside this block) ...

def get_db_engine():
    try:
        user = os.getenv("DB_USER", "postgres")
        password = os.getenv("DB_PASSWORD", "password")
        host = os.getenv("DB_HOST", "localhost")
        port = os.getenv("DB_PORT", "5432")
        dbname = os.getenv("DB_NAME", "dipk_db")
        
        url = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
        engine = create_engine(url)
        return engine
    except Exception as e:
        st.error(f"Erreur de connexion DB : {e}")
        return None

def load_data():
    engine = get_db_engine()
    if not engine:
        return pd.DataFrame(), pd.DataFrame()
    
    # Load Official Bins
    query_bins = """
        SELECT id, osm_id, tags, ST_X(geom::geometry) as lon, ST_Y(geom::geometry) as lat 
        FROM poubelles_officielles
    """
    try:
        with engine.connect() as conn:
            df_bins = pd.read_sql(query_bins, conn)
            
            # Load Reports
            query_reports = """
                SELECT id, status, status_message, image_path, latitude, longitude, created_at 
                FROM signalements
                ORDER BY created_at DESC
            """
            df_reports = pd.read_sql(query_reports, conn)
            
        return df_bins, df_reports
    except Exception as e:
        st.error(f"Erreur chargement données: {e}")
        return pd.DataFrame(), pd.DataFrame()

def archive_image(image_path, report_id):
    """Archive image to a local folder"""
    if not image_path or not os.path.exists(image_path):
        st.toast("Fichier introuvable.", icon="❌")
        return
    
    archive_dir = "archives"
    os.makedirs(archive_dir, exist_ok=True)
    
    filename = os.path.basename(image_path)
    dest_path = os.path.join(archive_dir, f"ARCHIVED_{report_id}_{filename}")
    
    try:
        shutil.copy2(image_path, dest_path)
        st.toast(f"Image archivée dans {dest_path}", icon="✅")
    except Exception as e:
        st.error(f"Erreur archivage: {e}")

# --- SIDEBAR ---
with st.sidebar:
    if os.path.exists("logo.png"):
        st.image("logo.png", width=200)
    
    st.title("DIPK Admin")
    st.info("Système de gestion des déchets pour Kinshasa.")
    
    if st.button("🔄 Actualiser Données", type="primary"):
        st.cache_data.clear()
        st.rerun()

    st.markdown("---")
    st.write("📂 **Exporter Données**")
    
    # helper for csv
    @st.cache_data
    def convert_df(df):
        return df.to_csv(index=False).encode('utf-8')

    # Access the dataframe from the main scope helper (needs reload to be safe or pass via session state, 
    # but simplest is to call load_data here or assume df_reports is available if we move this logic)
    # Better approach: Add this download button IN the main sidebar flow but call load_data first if needed.
    # Since we load data in main content, let's put the button in sidebar but using the loaded data from main would be tricky if sidebar renders first.
    # We will redefine load_data cached or just use the button in main content area for simplicity OR move load_data call to top.
    pass 
    # Wait, replace content logic: I will insert the button logic in the sidebar block.
    # I need to access df_reports. It is loaded at line 99. 
    # I should move load_data call to BEFORE sidebar or inside sidebar?
    # Actually, st runs top to bottom. If I put sidebar code at top, it runs. df_reports isn't there yet.
    # I will add the download button in the MAIN CONTENT or move load_data up.
    # Let's move load_data to the top of the script (it is defined but called at line 99).
    # I will put the download button in the SIDEBAR but I need to make sure df_reports is available.
    # The clean way: Call load_data() inside sidebar if I want it there, or just put the button in main area top right.
    # User said "possibilité de télécharger". Sidebar is good.
    # Let's add the button logic in the SIDEBAR but inside I will call load_data just for the export if it's not too heavy, 
    # OR better: Move 'df_bins, df_reports = load_data()' to line 80 (before sidebar content) so results are available.
    
    # PLAN:
    # 1. First edit: Move load_data() call to line 81 (inside sidebar scope or before).
    # 2. Second edit: Add download button.
    
    # Let's just Add the download button in the sidebar and call load_data there. 
    # It hits cache if I cache load_data? 
    # load_data is NOT cached currently (I removed it).
    # So calling it twice is bad.
    
    # Alternative: Put download button in the MAIN COLUMN (e.g. top right or below title).
    # Let's put it on the Main Content, right after Title. It's visible and easy.
    
    # Returning original content for this specific tool call to fail/cancel or I can just implement it in main body.
    # I will implement it in the main body (Metrics row or Header).

# --- MAIN CONTENT ---
st.title("♻️ Tableau de Bord - Kinshasa Propre")
st.markdown("---")

# Load Data
df_bins, df_reports = load_data()

# Metrics Row
col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("Total Poubelles", len(df_bins))
with col2:
    st.metric("Total Signalements", len(df_reports))
with col3:
    legal = len(df_reports[df_reports['status'] == 'LEGAL_MAINTENANCE'])
    st.metric("✅ Maintenance", legal)
with col4:
    illegal = len(df_reports[df_reports['status'] == 'ILLEGAL_DUMP'])
    st.metric("🚨 Illégal", illegal)

@st.cache_data
def convert_df(df):
    return df.to_csv(index=False).encode('utf-8')

csv = convert_df(df_reports)

st.download_button(
    label="📥 Télécharger Rapport (CSV)",
    data=csv,
    file_name='signalements_dipk.csv',
    mime='text/csv',
)

# --- MAP SECTION ---
st.subheader("📍 Carte des Signalements & Poubelles")

if not df_reports.empty:
    center_lat = df_reports['latitude'].mean()
    center_lon = df_reports['longitude'].mean()
else:
    center_lat, center_lon = -4.325, 15.322

m = folium.Map(location=[center_lat, center_lon], zoom_start=12)

# 1. Add Official Bins (Green)
for _, row in df_bins.iterrows():
    folium.Marker(
        location=[row['lat'], row['lon']],
        popup=f"Poubelle ID: {row['osm_id']}",
        tooltip="Poubelle Officielle",
        icon=folium.Icon(color="green", icon="trash", prefix='fa')
    ).add_to(m)

# 2. Add Reports (Red/Blue)
for _, row in df_reports.iterrows():
    is_illegal = row['status'] == "ILLEGAL_DUMP"
    
    # Robust logic for formatting
    color = "red" if is_illegal else "blue"
    icon_name = "exclamation-triangle" if is_illegal else "info-circle"
    status_label = "DÉPÔT ILLÉGAL" if is_illegal else "MAINTENANCE REQUISE"
    
    html_content = f"""
    <div style="font-family: Arial; width: 200px;">
        <h4 style="color: {color};">{status_label}</h4>
        <p><b>Msg:</b> {row['status_message']}</p>
        <p><b>Date:</b> {row['created_at']}</p>
    </div>
    """
    
    folium.Marker(
        location=[row['latitude'], row['longitude']],
        popup=folium.Popup(html_content, max_width=250),
        tooltip=status_label,
        icon=folium.Icon(color=color, icon=icon_name, prefix='fa')
    ).add_to(m)

st_folium(m, width="100%", height=500)

# --- REPORTS TABLE With IMAGES ---
st.markdown("---")
# --- SEPARATED LISTS (Illegal vs Legal) ---
st.markdown("---")
col_illegal, col_legal = st.columns(2)

# --- DIALOG FOR IMAGE VIEWING ---
@st.dialog("Preuve Photo")
def show_image_dialog(image_path, report_id):
    if os.path.exists(image_path):
        st.image(image_path, use_container_width=True)
        
        c1, c2 = st.columns(2)
        with c1:
            with open(image_path, "rb") as file:
                st.download_button(
                    label="📥 Télécharger",
                    data=file,
                    file_name=os.path.basename(image_path),
                    mime="image/jpeg",
                    key=f"dl_dialog_{report_id}"
                )
        with c2:
            if st.button("🗄️ Archiver", key=f"arch_dialog_{report_id}"):
                archive_image(image_path, report_id)
                st.rerun()
    else:
        st.error("Image introuvable.")

# Helper function to display card
def display_report_card(row, is_illegal):
    card_color = "#FFEBEE" if is_illegal else "#E3F2FD"
    border_color = "#FFCDD2" if is_illegal else "#BBDEFB"
    icon = "🚨" if is_illegal else "✅"
    
    with st.container():
        st.markdown(f"""
        <div style="background-color: {card_color}; padding: 10px; border-radius: 10px; border: 1px solid {border_color}; margin-bottom: 10px;">
            <h4>{icon} Signalement #{row['id']}</h4>
            <p><b>Date:</b> {row['created_at']}</p>
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown(f"**📍 Coordonnées:** `{row['latitude']}, {row['longitude']}`")
        if is_illegal:
            st.error(f"**Message:** {row['status_message']}")
        else:
            st.info(f"**Message:** {row['status_message']}")

        # Button to open Dialog
        img_path = row['image_path']
        # Normalize path just in case
        if img_path:
             img_path = os.path.abspath(img_path)
        
        if st.button(f"👁️ Voir l'image", key=f"view_{row['id']}"):
            show_image_dialog(img_path, row['id'])
            
        st.divider()

with col_illegal:
    st.header("🚨 Dépôts Illégaux")
    df_illegal = df_reports[df_reports['status'] == 'ILLEGAL_DUMP']
    if df_illegal.empty:
        st.success("Aucun dépôt illégal signalé.")
    else:
        for _, row in df_illegal.iterrows():
            display_report_card(row, is_illegal=True)

with col_legal:
    st.header("✅ Maintenance Poubelles")
    df_legal = df_reports[df_reports['status'] == 'LEGAL_MAINTENANCE']
    if df_legal.empty:
        st.info("Aucune maintenance requise.")
    else:
        for _, row in df_legal.iterrows():
            display_report_card(row, is_illegal=False)

